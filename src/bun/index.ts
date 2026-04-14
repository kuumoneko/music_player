// Electrobun
import { BrowserView, BrowserWindow, MenuItemConfig, Tray, Updater, Utils } from "electrobun/bun";
// Node
import { join, resolve } from "node:path";
// env variables
import { config } from "dotenv";
// Controller
import DownloadController from "./controllers/download.ts";
import HomeController from "./controllers/home.ts";
import MusicController from "./controllers/music.ts";
// lib
import { getDataFromDatabase } from "./lib/database.ts";
import getLocalIPv4 from "./lib/ipv4.ts";
import CheckUserData from "./lib/env.ts"
import { getAllLocalFiles, getUserData, getUserDatas, writeLogs, writeUserData, writeUserDatas } from "./db/index.ts";
// Features
import Player from "./music/index.ts"
import Discord from "./discord/index.ts";
// types
import { Repeat, Shuffle, SleepMode, Track, UserData } from "../shared/types.ts";
import type { AppRPCType, System } from "@/shared/types.ts";

config();

// app variables
const APP_ROOT = resolve("./", "..", "Resources", "app");
const { isLocal, isDiscord, appPort, playerPort, DiscordClientId } = await getDataFromDatabase(APP_ROOT, "data", "system");
if (isLocal === null || isDiscord === null || appPort === null || playerPort === null) {
	await Utils.showMessageBox({
		type: "error",
		message: "Null Object, please reinstall app."
	})
	process.exit(1);
}

let appWin: BrowserWindow | null = null;
let appTray: Tray | null = null;
let discordRPC: Discord | null = null;

const userData = resolve(Utils.paths.userData, "..");
CheckUserData();

let player: Player | null = null;

const current = {
	time: 0,
	duration: 0,
	isLived: false
};

() => {
	const temp = getUserData("current");
	writeUserDatas({
		isPlaying: false,
		isLoading: true
	})
	current.duration = temp.duration;
	current.isLived = temp.isLived
};

process.on("uncaughtException", (error) => {
	Utils.showMessageBox({
		type: "error",
		title: error.name,
		message: error.message,
		detail: error.cause as string + " " + error.stack
	})
	writeLogs([{
		type: "error",
		message: error.message
	}])
})

process.on('unhandledRejection', (reason, promise) => {
	writeLogs([{
		type: "error",
		message: `Unhandled Promise Rejection at: ${promise}`
	}, {
		type: "error",
		message: `Reason: ${reason}`
	}])
	process.exit(1);
});

process.on('beforeExit', (code) => {
	console.log(code)
})

process.on("exit", (code) => {
	console.log(code)
})

const getTrayMenu = (isShown: boolean): MenuItemConfig[] => [
	{
		type: "normal",
		label: "Show",
		action: "show",
		hidden: isShown
	},
	{
		type: "normal",
		label: "Hide",
		action: "hide",
		hidden: !isShown
	},
	{
		type: "separator"
	},
	{
		type: "normal",
		label: "Quit",
		action: "quit"
	},
];

const setDiscordRPC = () => {
	const user = getUserDatas(["currentPlaying", "isPlaying"]);
	if (isDiscord) {
		discordRPC?.setMusic(user.currentPlaying, player, current, true);
	}
};

const ytbTrackStart = "https://www.youtube.com/watch?v="

const play = () => {
	const currentPlaying = getUserData("currentPlaying");

	player.player.play(`${ytbTrackStart}${currentPlaying.id}`);
	setDiscordRPC();
}

player = new Player(userData, APP_ROOT);

player.player.on("exit", () => {
	appWin?.close();
});

player.player.on("change-playState", (data) => {
	writeUserData("isPlaying", data);
	setDiscordRPC();
})

player.player.on("time-update", (time) => {
	current.time = time;
});

player.player.on("playing", async (data) => {
	if (!data) return;

	if (data.includes(`${ytbTrackStart}`)) {
		const id = data.split(`${ytbTrackStart}`)[1];
		if (!id || id === "undefined") return;
		const track = (await player.youtube.fetch_track([id]))[0] ?? null;
		writeUserData("currentPlaying", {
			source: "youtube",
			title: track.name,
			thumbnail: track.thumbnail,
			artist: track.artist.map(item => item.name).join(", "),
			duration: track.duration,
			id: track.id
		})
		if (isDiscord) {
			discordRPC?.setMusic({
				source: "youtube",
				title: track.name,
				thumbnail: track.thumbnail,
				artist: track.artist.map(item => item.name).join(", "),
				duration: track.duration,
				id: track.id
			}, player, { time: 0, duration: track.duration }, true);
		}
		player.player.setVideoMetadata(track.thumbnail, track.name, track.artist.map(item => item.name).join(", "))
	}
	player.player.getQueue();
})

player.player.on("queue", async (data: { filename: string, playing: boolean }[]) => {
	if (!data) return;
	let isYTB = false;
	if (data[0].filename.includes(ytbTrackStart)) {
		isYTB = true;
		data = data.filter(item => item.filename.includes(ytbTrackStart))
	}
	else {
		data = data.filter(item => !item.filename.includes(ytbTrackStart))
	}

	const currentTrack = data.splice(0, 1)[0].filename;
	const ids = data.map(item => isYTB ? item.filename.split(ytbTrackStart)[1] : item.filename);


	const { nextfrom, playQueue, shuffle } = getUserDatas(["nextfrom", "playQueue", "shuffle"]) as UserData;
	const notinQueue = ids.filter(item => playQueue.includes(item));
	let result = [];
	playQueue.forEach(item => {
		const [source, id] = item.split(":")
		if (source === "youtube") {
			result.push(`${ytbTrackStart}${id}`)
		}
		else {
			result.push(id)
		}
	});
	result.push(...notinQueue);
	if (result.length < 25) {
		const [source, mode, id] = nextfrom.split(":");
		if (mode === "track") {
			player.player.setRepeat(true);
		}
		else if (source === "youtube") {
			let data: Track[] = null;
			if (mode.includes("artist")) {
				data = (await player.youtube.fetch_artist(id)).tracks;
			}
			else if (mode.includes("playlist")) {
				data = (await player.youtube.fetch_playlist(id)).tracks;
			}
			if (data?.length > 0) {
				if (shuffle === Shuffle.Enable) {
					for (let i = data.length - 1; i > 0; i--) {
						const j = Math.floor(Math.random() * (i + 1));
						[data[i], data[j]] = [data[j], data[i]];
					}
					result.push(...data.slice(0, 25 - result.length).map(item =>
						item.source === "youtube" ? `${ytbTrackStart}${item.id}` : item.id
					))
				}
				else {
					let index = 0;
					if (result.length > 0) {
						index = data.findIndex(item => item.id === result[result.length - 1].split(ytbTrackStart)[1]);
					}
					else {
						index = data.findIndex(item => item.id === currentTrack.split(ytbTrackStart)[1]);
					}
					result.push(...Array.from({ length: 25 - result.length + 1 }, (_, i) => data[(index + i) % data.length]).map(item =>
						item.source === "youtube" ? `${ytbTrackStart}${item.id}` : item.id
					))
				}
			}
		}
		writeUserData("nextfrom", nextfrom)
	}
	result = [...new Set(result.filter(item => item !== currentTrack))];
	player.player.addTracks(result)
})

player.player.on("duration-update", (duration) => {
	current.duration = duration * 1000;
	const temp = getUserData("current");
	if (temp.duration !== duration * 1000) {
		temp.duration = duration * 1000;
		writeUserData("current", temp);
	}
});

player.player.on("is-live", (isLived) => {
	current.isLived = isLived;
	const temp = getUserData("current");
	temp.isLived = isLived;
	writeUserData("current", temp);
});

player.player.on("start-file", () => {
	writeUserData("isLoading", true)
});

player.player.on("file-loaded", () => {
	writeUserData("isLoading", false)
});

() => {
	const folder = getUserData("folder");
	if (folder.length > 0 && isLocal) {
		player.local.getfolder(folder);
	}
}

const withSafeEncoding = <T extends Record<string, any>>(handlers: T): T => {
	const wrappedHandlers: any = {};

	for (const [key, handler] of Object.entries(handlers)) {
		if (typeof handler === "function") {
			wrappedHandlers[key] = async (...args: any[]) => {
				const result = await handler(...args);
				if (result !== undefined) {
					return encodeURIComponent(JSON.stringify(result));
				}
				return result;
			};
		} else {
			wrappedHandlers[key] = handler;
		}
	}

	return wrappedHandlers as T;
};

// @ts-ignore
const appRPC = BrowserView.defineRPC<AppRPCType>({
	maxRequestTime: 60 * 1000,
	handlers: {
		requests: withSafeEncoding(
			{
				getMusicData: async ({ source, type, id }: { source: "youtube" | "local", type: string, id: string }) => {
					try {
						const result = await MusicController(player, {
							source: source,
							type: type,
							id: id,
							query: "",
							mode: ""
						})
						return result
					} catch (error) {
						writeLogs([{
							type: "error", message: `Error when getting music data with:\nSource = ${source}\nMode = ${type}\nId = ${id}\n ${error}`
						}]);
						return null;
					}
				},
				getLocalfile: async () => {
					try {
						const result = getAllLocalFiles();
						return result;
					} catch (error) {
						writeLogs([{ type: "error", message: `Error when getting Local files:\n${error}` }]);
						return null;
					}
				},
				searchMusic: async ({ type, query }: { type: "video" | "playlist" | "artist", query: string }) => {
					try {
						const result = await MusicController(player, {
							source: "youtube",
							id: "",
							type: type,
							query: query, mode: "search"
						})
						return result
					} catch (error) {
						writeLogs([{ type: "error", message: `Error when searching music data with:\nType = ${type}\nQuery = ${query}\n${error}` }]);
						return null;
					}
				},
				getHomeData: async () => {
					try {
						const pin = getUserData("pin")
						const result = await HomeController(player, pin);
						return result;
					} catch (error) {
						writeLogs([{ type: "error", message: `Unexpected error when getting home data:\n${error}` }]);
						return null;
					}
				},
				getSystem: (key: keyof System) => { return key === "isDiscord" ? isDiscord : isLocal },
				downloadMusic: async () => {
					try {
						const downloadQueue = getUserData("downloadQueue")
						if (downloadQueue.length === 0) {
							throw new Error("No download queue");
						}
						if (!isLocal) {
							throw new Error("User dont set this app has local file")
						}
						return await DownloadController(player);
					} catch (error) {
						writeLogs([{ type: "error", message: `Error when preparing download music:\n${error}` }]);
						return null;
					}
				},
				getDownloadStatus: async () => {
					return !isLocal ? null : player.status;
				},
				close: async () => {
					const QuitonClose = getUserData("QuitonClose");
					if (QuitonClose === true) {
						appWin?.close();
					}
					else {
						appWin?.hide();
						appTray?.setMenu(getTrayMenu(false));
					}
				},
				minimize: async () => {
					appWin?.minimize();
				},
				toggleQuitonClose: async () => {
					writeUserData("QuitonClose", !getUserData("QuitonClose"))
				},
				isQuitonClose: async () => {
					const QuitonClose = getUserData("QuitonClose")
					return QuitonClose;
				},
				togglePlayPause: async () => {
					if (!player.player.isReady) return;
					const isPlaying = getUserData("isPlaying");
					player.player.togglePlayPause(!isPlaying);
				},
				getUserData: async (key: keyof UserData) => {
					if (key === "folder" && !isLocal) {
						return null;
					}
					return getUserData(key)
				},
				setUserData: async ({ key, data }: { key: keyof UserData, data: any }) => {
					try {
						if (key === "folder" && !isLocal) {
							return null;
						}
						else if (key === "folder") {
							const value = await Utils.openFileDialog({
								canChooseDirectory: true,
								canChooseFiles: false
							});

							if (!value || value.length === 0) {
								return { ok: false, data: "No folder selected" };
							}
							writeUserData("folder", value[0])
							player.local.getfolder(value[0]);

							return value[0];
						}
						writeUserData(key, data)

						if (key === "volume") {
							player.player.setVolume(data);
						}
						if (key === "repeat") {
							player.player.setRepeat(data === Repeat.One);
						}
					} catch (error) {
						writeLogs([{ type: "error", message: `Error when writing user data with\nKey = ${key}\nValue = ${data}\n${error}` }]);
						return null;
					}
				},
				getPlayingData: async () => {
					const result = getUserDatas(["shuffle", "repeat", "isPlaying", "isLoading", 'playedTrack', 'current']);
					return {
						...result,
						current
					}
				},
				next: async () => {
					try {
						player.player.next();
					} catch (error) {
						writeLogs([{ type: "error", message: `Error when switching to next track\n${error}` }]);
						return null;
					}
				},
				previous: async () => {
					try {
						player.player.previous();
					} catch (error) {
						writeLogs([{ type: "error", message: `Error when switching to previous track\n${error}` }]);
						return null;
					}
				},
				play: async ({ item, source, type, id }: { item: Track, source: "youtube" | "local", type: "track" | "playlist" | "artist", id: string }) => {
					const user = getUserDatas(["playQueue", "currentPlaying", "shuffle", "repeat", "playedTrack", "nextfrom"])
					user.playQueue = [];
					player.player.setRepeat(false);

					if (source === "youtube") {
						const track = await player.youtube.fetch_track([item.id])
						user.currentPlaying = {
							source, id: item.id, title: track[0].name, thumbnail: track[0].thumbnail, artist: track[0].artist.map((item) => item.name).join(", ")
						}
						current.duration = track[0].duration;
						user.nextfrom = `youtube:${type}:${id}`
					}
					else if (source === "local") {
						const localFiles = getAllLocalFiles();
						const track = localFiles.find((localItem) => localItem.id === item.id);
						user.currentPlaying = {
							source, id: item.id, title: track?.name, thumbnail: track?.thumbnail, artist: track?.artist.map((item: any) => item.name).join(", "), index: track?.index
						}
						current.duration = track?.duration;
						current.isLived = false;
						user.nextfrom = "local:local";
					}
					current.time = 0;
					user.repeat = user.repeat === Repeat.Disable ? Repeat.Disable : Repeat.All;

					user.playedTrack = Array.from(new Set([...user.playedTrack, user.currentPlaying.id]));
					writeUserDatas(user);
					play();
					return user.currentPlaying
				},
				seekTo: async (time: number) => {
					try {
						current.time = time;
						player.player.seekTo(time);
						setInterval(() => {
							setDiscordRPC();
						}, 300);
					} catch (error) {
						writeLogs([{ type: "error", message: `Error when changing time\n${error}` }]);
						return null;
					}
				},
				setSleep: async (mode: SleepMode) => {
					try {
						player.player.setSleep(mode);
					} catch (error) {
						writeLogs([{ type: "error", message: `Error when setting Sleep mode\n${error}` }]);
						return null;
					}
				},
				checkUpdate: async () => {
					try {
						const { version } = await Updater.getLocallocalInfo();
						const { updateAvailable } = await Updater.checkForUpdate();
						return updateAvailable === true ? updateAvailable : version;
					} catch (error) {
						writeLogs([{ type: "error", message: `Error when checking for update\n${error}` }]);
						return null;
					}
				},
				update: async () => { Updater.applyUpdate(); },
				isHasDiscordRPC: async () => {
					if (isDiscord) {
						return discordRPC?.username ?? false;
					}
					else return null;
				},
				connectDiscordRPC: async () => {
					try {
						if (isDiscord) {
							discordRPC = new Discord(DiscordClientId);
							try {
								await discordRPC.connect();
								return discordRPC?.username ?? false;
							} catch (error) {
								Utils.showMessageBox({
									type: "info",
									title: "Discord Client is not running",
									message: "Please open Discord Client then Connect again."
								});
								return false;
							}
						}
						else {
							Utils.showMessageBox({
								type: "info",
								title: "Discord RPC is not installed",
								message: "Please reinstall and set isDiscord is true."
							});
							return null;
						}
					} catch (error) {
						writeLogs([{ type: "error", message: `Error when connecting with Discord\n${error}` }]);
						return null;
					}
				},
				sendError: (error: Error) => {
					writeLogs([
						{ type: "error", message: error.name ?? "" },
						{ type: "error", message: error.message ?? "" },
						{ type: "error", message: error.stack ?? "" },

					])
				},
				openDevTools: () => {
					appWin?.webview.openDevTools();
				}
			}
		)
	}
})

let isFirstLoad = true;

const openAppUI = () => {
	appWin = new BrowserWindow({
		title: "Music app", url: "views://src/index.html", rpc: appRPC, titleBarStyle: "hidden",
		preload: `window.addEventListener('contextmenu', (e) => { e.preventDefault(); }, false); `
	})
	appWin?.webview?.on("dom-ready", () => {
		appWin?.maximize();
		if (isFirstLoad) {
			isFirstLoad = false;
			play();
		}
		writeUserData("isPlaying", false);
	})
}

if (!isLocal) {
	writeUserDatas({
		folder: "",
		downloadQueue: [],
	})

	for (const binFile of ["ffmpeg", "ffprobe"]) {
		const file = Bun.file(resolve(APP_ROOT, "bin", `${binFile}.exe`));
		if (await file.exists()) {
			file.delete();
		}
	}
}

const host = getLocalIPv4();
const port = appPort;
const lockUrl = `http://${host}:${port}`
try {
	const response = await fetch(lockUrl);

	if (response.ok) {
		writeLogs([{
			type: "error", message: `Error on sending rpc`
		}])
		process.stdout.write("lmao\n"), () => { process.exit(0); };
	}
} catch (error: any) {
	Bun.serve({
		port: port,
		hostname: host,
		async fetch(_req: any) {
			openAppUI();
			return new Response("OK");
		}
	});
}

if (isDiscord && DiscordClientId.length > 0) {
	discordRPC = new Discord(DiscordClientId);
	try {
		await discordRPC.connect();
	} catch { }
}

// Create Tray Menu
appTray = new Tray({
	title: "Music app",
	image: join(APP_ROOT, "assets", "trayicon.ico"),
	template: true
});
appTray?.setMenu(getTrayMenu(true));
appTray?.on("tray-clicked", (e: any) => {
	const action = e?.data?.action ?? "nothing";

	if (action === "show") {
		appWin?.show();
		appTray?.setMenu(getTrayMenu(true));
	}
	else if (action === "hide") {
		appWin?.hide();
		appTray?.setMenu(getTrayMenu(false));
	}
	else if (action === "quit") {
		appWin?.close();
	}
});

openAppUI();