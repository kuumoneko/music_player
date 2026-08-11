import { dirname, join, resolve } from "node:path";
import { existsSync, mkdirSync } from "node:fs";
import { rmdir } from "node:fs/promises";
import { MusicSource, MusicType, type System } from "../shared/types.ts";
import { parseAppArgs } from "./lib/args.ts";
import { RpcWsServer } from "./rpc/ws-server.ts";
import { QueueManager } from "./queue/manager.ts";
import { createRpcHandlers } from "./rpc/handlers.ts";
import getLocalIPv4 from "./lib/ipv4.ts";
import CheckUserData from "./lib/env.ts";
import Player from "./music/index.ts";
import DiscordRPC from "./discord/index.ts";
import formatArtists from "../shared/utils/formatArtist.ts";
import { YTB_TRACK_START } from "../shared/constants.ts";
import {
	getAllLocalFiles,
	getTracks,
	getUserData,
	writeLogs,
	writeTracks,
	writeUserData,
	writeUserDatas,
	deleteTracks,
	purgeExpiredSearchCache,
	seedSystemFromAssets,
} from "./db/index.ts";
import { getHash, getPath } from "./lib/hash.ts";
import { setHomeEmitDataChanged } from "./controllers/home.ts";
// --- Config ---
const APP_ROOT = resolve("./");
const appArgs = parseAppArgs(process.argv);
const assetsDir = appArgs.assetsDir || APP_ROOT;
const userData = appArgs.dataDir || resolve(APP_ROOT, "data");
mkdirSync(userData, { recursive: true });

// Installer-run seeding mode: copies data/system.json into the app_data.sqlite
// system table, then deletes system.json and the now-empty data folder.
// Best-effort: failures exit 0 so the installer never aborts on this step.
if (process.argv.includes("--seed")) {
	try {
		const systemFilePath = join(assetsDir, "data", "system.json");
		const hadSystemFile = existsSync(systemFilePath);
		await seedSystemFromAssets(assetsDir, { deleteFile: true });
		if (hadSystemFile && !existsSync(systemFilePath)) {
			const dataFolder = dirname(systemFilePath);
			try {
				await rmdir(dataFolder);
				console.log("[seed] removed empty data folder.");
			} catch {
				// folder still non-empty or locked — leave it
			}
		}
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		console.error(`[seed] failed: ${message} (runtime seed will handle it)`);
	}
	process.exit(0);
}

const { isLocal, isDiscord, appPort, DiscordClientId } = await seedSystemFromAssets(assetsDir) as System;
if ([isLocal, isDiscord, appPort].includes(null)) {
	writeLogs([{ type: "error", message: "Null Object, please reinstall app." }]);
	process.exit(1);
}

CheckUserData();
purgeExpiredSearchCache();
const cachePurgeTimer = setInterval(purgeExpiredSearchCache, 6 * 60 * 60 * 1000);
(cachePurgeTimer as any).unref?.();

// Pre-populate hash map so persisted session data (playQueue, currentPlaying) resolves
if (isLocal) {
	for (const track of getAllLocalFiles()) {
		getHash(track.id);
	}
}

// --- State ---
const firstLoadCurrent = getUserData("current");
class PlayerState {
	time = 0;
	duration = firstLoadCurrent?.duration ?? 0;
	isLived = firstLoadCurrent?.isLived ?? false;
	isPlaying = false;

	update(partial: Partial<Pick<PlayerState, "time" | "duration" | "isLived" | "isPlaying">>) {
		Object.assign(this, partial);
		emitToFrontend("timeUpdate", { time: this.time, isPlaying: this.isPlaying });
		if (partial.isPlaying !== undefined) {
			setDiscordRPC();
		}
	}

	updateDuration(duration: number) {
		this.duration = duration * 1000;
		let currentData = getUserData("current");
		if (currentData?.duration !== this.duration) {
			if (currentData === null) { currentData = { duration: 0, isLived: false } }
			currentData.duration = this.duration;
			writeUserData("current", currentData);
		}
		this.emitPlayerState({ isLoading: false });
	}

	updateIsLived(isLived: boolean) {
		this.isLived = isLived;
		let currentData = getUserData("current");
		if (currentData === null) { currentData = { duration: 0, isLived: false } }
		currentData.isLived = isLived;
		writeUserData("current", currentData);
		this.emitPlayerState({ isLoading: false });
	}

	emitPlayerState(extra: { isPlaying?: boolean; isLoading?: boolean; duration?: number; isLived?: boolean }) {
		emitToFrontend("playerStateChange", {
			isPlaying: extra.isPlaying ?? this.isPlaying,
			isLoading: extra.isLoading ?? false,
			duration: extra.duration ?? this.duration,
			isLived: extra.isLived ?? this.isLived,
		});
	}
}
const current = new PlayerState();
writeUserData("isLoading", true);

let isFirstLoad = true;
let folder = getUserData("folder") ?? "";
// --- Managers ---
let rpcServer: RpcWsServer | null = null;
const player = new Player(userData, APP_ROOT, folder);
await player.init();
player.onStatusChange = (status) => emitToFrontend("download-status-changed", status);
let resolveMpvReady: () => void;
const mpvReady = new Promise<void>((resolve) => { resolveMpvReady = resolve; });
setTimeout(() => player.initMpv(), 0);
setTimeout(() => resolveMpvReady(), 10000); // safety timeout
const queueManager = new QueueManager(player);
if (folder.length > 0 && isLocal) {
	player.local?.scanFolder(folder).then(() => {
		emitToFrontend("local-files-changed", null);
	});
}

// --- Helpers ---
const emitToFrontend = (message: string, payload: any) => {
	try {
		rpcServer?.broadcast(message, payload);
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		writeLogs([{ type: "error", message }]);
	}
};

const emitError = (error: unknown) => {
	const message = error instanceof Error ? error.message : String(error);
	const stack = error instanceof Error ? error.stack : undefined;
	writeLogs([{ type: "error", message }]);
	if (stack) writeLogs([{ type: "error", message: stack }]);
	emitToFrontend("error", { message, stack });
};

player.youtubeDataAPI.emitDataChanged = (key) => emitToFrontend("dataChanged", { key });
setHomeEmitDataChanged((key) => emitToFrontend("dataChanged", { key }));

const discordRPC = { instance: null as DiscordRPC | null };

const setDiscordRPC = () => {
	const currentPlaying = getUserData("currentPlaying");
	if (isDiscord) {
		if (current.isPlaying) {
			discordRPC.instance?.setMusic(currentPlaying, player, current);
		} else {
			discordRPC.instance?.clearMusic();
		}
	}
};

const play = async () => {
	await mpvReady;
	const currentPlaying = getUserData("currentPlaying");
	if (!currentPlaying?.id) {
		writeUserData("isLoading", false);
		current.emitPlayerState({ isLoading: false });
		return;
	}
	const url = currentPlaying.source === MusicSource.Youtube
		? `${YTB_TRACK_START}${currentPlaying.id}`
		: (getPath(currentPlaying.id) ?? currentPlaying.id);
	player.player?.play(url, currentPlaying.title, currentPlaying.thumbnail);
};

// --- Player Events ---
player.player?.on("track-error", (data: any) => {
	const id = typeof data === "string" ? data : data.id;
	const error = typeof data === "string" ? "not found" : data.error;
	emitToFrontend("error", { message: `"${id}" is unavailable (${error}). Skipping to next.` });
	writeUserData("currentPlaying", { source: MusicSource.Youtube, id: "", title: "", thumbnail: "", artist: "", artistId: "" });
	emitToFrontend("currentTrackChanged", { source: "", id: "", title: "", thumbnail: "", artist: "", artistId: "" });
	const playedTrack = getUserData("playedTrack") ?? [];
	writeUserData("playedTrack", playedTrack.filter((t: string) => t !== id));
	discordRPC.instance?.clearMusic();
	if (typeof data !== "string") {
		deleteTracks([id]);
	}
	player.player?.next();
	player.player?.getQueue();
});

player.player?.on("smtc-update", (data: unknown) => {
	emitToFrontend("smtc-update", data);
});

player.player?.on("exit", () => {
	emitToFrontend("app-exit", null);
	setTimeout(() => process.exit(0), 2000);
});

player.player?.on("change-playState", (data: { isPlaying: boolean; time: number }) => {
	const update: Partial<Pick<PlayerState, "time" | "isPlaying">> = {};
	if (data.isPlaying !== undefined && data.isPlaying !== null) {
		update.isPlaying = data.isPlaying;
		current.emitPlayerState({ isPlaying: data.isPlaying });
	}
	if (data.time !== undefined && data.time !== null) {
		update.time = data.time;
	}
	if (Object.keys(update).length > 0) {
		current.update(update);
	}
});

player.player?.on("playing", async (data) => {
	if (!data) return;

	let id = data.split(`${YTB_TRACK_START}`)[1];
	let isYoutube = true;
	if (!id) {
		id = data;
		isYoutube = false;
	}
	const track = getTracks([id])[0] ?? null;
	if (track === null) {
		discordRPC.instance?.clearMusic();
		return;
	}
	let tempThumbnail = track.thumbnail;
	if (!isYoutube) {
		if (track.youtubeTrackId) {
			const ytTrack = getTracks([track.youtubeTrackId])[0];
			if (ytTrack?.thumbnail) {
				tempThumbnail = ytTrack.thumbnail;
			}
		} else if (track.youtubeTrackId === null || track.youtubeTrackId === undefined) {
			try {
				const ytSearch = await player.youtubeDataAPI.search(track.name, MusicType.Track) ?? { tracks: [] };
				if (ytSearch.tracks.length > 0) {
					const matched = ytSearch.tracks[0];
					writeTracks([matched]);
					writeTracks([{ ...track, youtubeTrackId: matched.id }]);
					tempThumbnail = matched.thumbnail;
				} else {
					writeTracks([{ ...track, youtubeTrackId: "" }]);
				}
			} catch (e) {
				writeLogs([{ type: "error", message: `YouTube search for local track failed: ${e instanceof Error ? e.message : String(e)}` }]);
			}
		}
	}

	const currentPlaying = {
		source: isYoutube ? MusicSource.Youtube : MusicSource.Local,
		title: track.name,
		thumbnail: tempThumbnail,
		artist: formatArtists(track.artist),
		artistId: track.artist?.[0]?.id ?? "",
		duration: track.duration,
		id: track.id,
	};
	writeUserData("currentPlaying", currentPlaying);
	player.player?.updateSMTC();
	emitToFrontend("currentTrackChanged", {
		...currentPlaying,
		id: isYoutube ? currentPlaying.id : getHash(currentPlaying.id),
	});
	if (isDiscord) {
		discordRPC.instance?.setMusic(currentPlaying, player, { time: 0, duration: track.duration });
	}
	player.player?.getQueue();
});

player.player?.on("queue", async (data: { filename: string; playing: boolean }[]) => {
	try {
		await queueManager.refillQueue(data, emitToFrontend);
	} catch (error) {
		emitError(error);
	}
});

player.player?.on("duration-update", (duration) => {
	current.updateDuration(duration);
});

player.player?.on("is-live", (isLived) => {
	current.updateIsLived(isLived);
});

player.player?.on("loading", (data) => {
	writeUserData("isLoading", data);
	current.emitPlayerState({ isLoading: data });
});

player.player?.on("ended", () => {
	current.isPlaying = false;
	current.emitPlayerState({ isPlaying: false });
	discordRPC.instance?.clearMusic();
});

player.player?.on("ready", () => {
	resolveMpvReady();
	current.emitPlayerState({ isLoading: false });
});

// --- Discord Init (before RPC so context sees value) ---
if (isDiscord && String(DiscordClientId).length > 0) {
	const DiscordModule = await import("./discord/index.ts");
	discordRPC.instance = new DiscordModule.default(String(DiscordClientId));
	try {
		await discordRPC.instance.connect();
	} catch (e) {
		emitError(e);
	}
}

// --- RPC ---
const handlers = createRpcHandlers({
	player,
	current,
	isLocal: isLocal ?? false,
	isDiscord: isDiscord ?? false,
	DiscordClientId,
	discordRPC,
	emitToFrontend,
	emitError,
	play,
}) as any;

// --- Cleanup local-only resources ---
if (!isLocal) {
	writeUserDatas({
		folder: "",
		downloadQueue: [],
	});
}

// --- Server (lock check + WebSocket RPC) ---
const host = getLocalIPv4();
const port = appArgs.port ?? appPort ?? 12345;

if (!appArgs.noLock) {
	try {
		const response = await fetch(`http://${host}:${port}`, { signal: AbortSignal.timeout(100) });
		if (response.ok) {
			writeLogs([{
				type: "error",
				message: `Error on sending tick to http://${host}:${port}\n${response.statusText}`,
			}]);
			process.exit(42);
		}
	} catch {
		// port free, bind below
	}
}

rpcServer = new RpcWsServer(handlers, {
	onTick: () => {
		rpcServer?.broadcast("open-app", null);
	},
	onFirstClient: () => {
		if (isFirstLoad) {
			isFirstLoad = false;
			play();
		}
	},
});

try {
	rpcServer.start(host, port);
} catch (e) {
	emitError(`Failed to start server: ${e instanceof Error ? e.message : String(e)}`);
	process.exit(1);
}

const endpointLine = `KUUMO_WS=ws://${rpcServer.hostname}:${rpcServer.port}/ws`;
process.stdout.write(endpointLine + "\n");
writeLogs([{ type: "info", source: "backend", message: endpointLine }]);
