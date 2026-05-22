import { BrowserView, Utils } from "electrobun/bun";
import { resolve } from "node:path";
import type { AppRPCType } from "@/shared/types.ts";
import type { System } from "@/shared/types.ts";

import { getDataFromDatabase } from "./lib/database.ts";
import { withSafeEncoding } from "./lib/encoding.ts";
import { WindowManager } from "./window/manager.ts";
import { QueueManager } from "./queue/manager.ts";
import { createRpcHandlers } from "./rpc/handlers.ts";
import getLocalIPv4 from "./lib/ipv4.ts";
import CheckUserData from "./lib/env.ts";
import Player from "./music/index.ts";
import DiscordRPC from "./discord/index.ts";
import formatArtists from "../shared/utils/formatArtist.ts";
import {
	getTrackByName,
	getTracks,
	getUserData,
	writeLogs,
	writeUserData,
	writeUserDatas,
} from "./db/index.ts";

// --- Config ---
const APP_ROOT = resolve("./");
const APP_ASSETS = resolve(APP_ROOT, "..", "Resources", "app");

const { isLocal, isDiscord, appPort, DiscordClientId } = await getDataFromDatabase(APP_ASSETS, "data", "system") as System;
if ([isLocal, isDiscord, appPort].includes(null)) {
	await Utils.showMessageBox({ type: "error", message: "Null Object, please reinstall app." });
	process.exit(1);
}

const userData = resolve(Utils.paths.userData, "..");
CheckUserData();
const ytbTrackStart = "https://www.youtube.com/watch?v=";

// --- State ---
const firstLoadCurrent = getUserData("current");
class PlayerState {
	time = 0;
	duration = firstLoadCurrent.duration;
	isLived = firstLoadCurrent.isLived;
	isPlaying = false;

	update(partial: Partial<Pick<PlayerState, "time" | "duration" | "isLived" | "isPlaying">>) {
		Object.assign(this, partial);
		emitToFrontend("timeUpdate", { time: this.time, isPlaying: this.isPlaying });
		setDiscordRPC();
	}

	updateDuration(duration: number) {
		this.duration = duration * 1000;
		const temp = getUserData("current");
		if (temp.duration !== this.duration) {
			temp.duration = this.duration;
			writeUserData("current", temp);
		}
		this.emitPlayerState({ isLoading: false });
	}

	updateIsLived(isLived: boolean) {
		this.isLived = isLived;
		const temp = getUserData("current");
		temp.isLived = isLived;
		writeUserData("current", temp);
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

// --- Managers ---
const windowManager = new WindowManager(APP_ASSETS);
const player = new Player(userData, APP_ROOT, getUserData("folder"));
await player.init();
player.onStatusChange = (status) => emitToFrontend("download-status-changed", status);
const queueManager = new QueueManager(player);
if (getUserData("folder").length > 0 && isLocal) {
	player.local?.getfolder(getUserData("folder")).then(() => {
		emitToFrontend("local-files-changed", null);
	});
}

// --- Helpers ---
const emitToFrontend = (message: string, payload: any) => {
	try {
		(appRPC as any)?.send(message, payload);
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		writeLogs([{ type: "error", message }]);
	}
};

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

const play = () => {
	const currentPlaying = getUserData("currentPlaying");
	const url = currentPlaying.source === "youtube"
		? `${ytbTrackStart}${currentPlaying.id}`
		: currentPlaying.id;
	player.player.play(url, currentPlaying.title, currentPlaying.thumbnail);
};

// --- Player Events ---
player.player.on("exit", () => {
	windowManager.window?.close();
	Utils.quit();
});

player.player.on("change-playState", (data: { isPlaying: boolean; time: number }) => {
	const update: Partial<Pick<PlayerState, "time" | "isPlaying">> = {};
	if (data.isPlaying !== undefined && data.isPlaying !== null) {
		update.isPlaying = data.isPlaying;
	}
	if (data.time !== undefined && data.time !== null) {
		update.time = data.time;
	}
	if (Object.keys(update).length > 0) {
		current.update(update);
	}
});

player.player.on("playing", async (data) => {
	if (!data) return;

	setDiscordRPC();
	let id = data.split(`${ytbTrackStart}`)[1];
	let isYoutube = true;
	if (!id) {
		id = data;
		isYoutube = false;
	}
	const track = getTracks([id])[0] ?? null;

	let temp_thumbnail = track.thumbnail;
	if (!isYoutube) {
		const youtubeTrack = getTrackByName(track.name)[0];
		const isAvaiable = await player.youtube.checkYoutubeTracks([youtubeTrack.id]);
		temp_thumbnail = isAvaiable ? youtubeTrack.thumbnail : track.thumbnail;
	}

	const currentPlaying = {
		source: isYoutube ? "youtube" : "local",
		title: track.name,
		thumbnail: temp_thumbnail,
		artist: formatArtists(track.artist),
		duration: track.duration,
		id: track.id,
	};
	writeUserData("currentPlaying", currentPlaying);
	emitToFrontend("currentTrackChanged", currentPlaying);
	if (isDiscord) {
		discordRPC.instance?.setMusic(currentPlaying, player, { time: 0, duration: track.duration });
	}
	player.player.getQueue();
});

player.player.on("queue", async (data: { filename: string; playing: boolean }[]) => {
	try {
		await queueManager.refillQueue(data, emitToFrontend);
	} catch (error) {
		console.error(error);
	}
});

player.player.on("duration-update", (duration) => {
	current.updateDuration(duration);
});

player.player.on("is-live", (isLived) => {
	current.updateIsLived(isLived);
});

player.player.on("loading", (data) => {
	current.emitPlayerState({ isLoading: data });
});

player.player.on("ready", () => {
	current.emitPlayerState({ isLoading: false });
});

// --- Discord Init (before RPC so context sees value) ---
if (isDiscord && String(DiscordClientId).length > 0) {
	const DiscordModule = await import("./discord/index.ts");
	discordRPC.instance = new DiscordModule.default(String(DiscordClientId));
	try {
		await discordRPC.instance.connect();
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		writeLogs([{ type: "error", message }]);
	}
}

// --- RPC ---
// @ts-ignore
const appRPC = BrowserView.defineRPC<AppRPCType>({
	maxRequestTime: 60 * 1000,
	handlers: {
		messages: {},
		requests: withSafeEncoding(
			createRpcHandlers({
				player,
				windowManager,
				current,
				isLocal,
				isDiscord,
				DiscordClientId,
				discordRPC,
				emitToFrontend,
				setDiscordRPC,
				play,
			}),
		),
	},
});

// --- Cleanup local-only resources ---
if (!isLocal) {
	writeUserDatas({
		folder: "",
		downloadQueue: [],
	});

	for (const binFile of ["ffmpeg", "ffprobe"]) {
		const file = Bun.file(resolve(APP_ROOT, `${binFile}.exe`));
		if (await file.exists()) {
			file.delete();
		}
	}
}

// --- Lock server ---
const host = getLocalIPv4();
const port = appPort;
const lockUrl = `http://${host}:${port}`;
try {
	const response = await fetch(lockUrl, { signal: AbortSignal.timeout(100) });
	if (response.ok) {
		writeLogs([{
			type: "error",
			message: `Error on sending tick to ${lockUrl}\n${response.statusText}`,
		}]);
		process.stdout.write(`Error on sending tick to ${lockUrl}\n`, () => {
			process.exit(0);
		});
	}
} catch {
	try {
		Bun.serve({
			port,
			hostname: host,
			fetch(_req) {
				openAppUI();
				return new Response("OK");
			},
		});
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		writeLogs([{ type: "error", message: `Failed to start lock server: ${message}` }]);
		process.exit(1);
	}
}

// --- Tray & UI ---
const onTrayAction = (action: string) => {
	if (action === "show") {
		openAppUI();
		windowManager.setTrayMenu(true);
	} else if (action === "hide") {
		windowManager.window?.close();
		windowManager.setTrayMenu(false);
	} else if (action === "quit") {
		windowManager.window?.close();
		Utils.quit();
	}
};

windowManager.createTray(onTrayAction);
openAppUI();

function openAppUI() {
	const onFirstDomReady = () => {
		play();
		isFirstLoad = false;
	};
	windowManager.openAppUI(appRPC, isFirstLoad ? onFirstDomReady : undefined, isFirstLoad);
}
