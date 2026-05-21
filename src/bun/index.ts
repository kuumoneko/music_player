// Electrobun
import { BrowserView, BrowserWindow, MenuItemConfig, Tray, Updater, Utils, Screen } from "electrobun/bun";
// Node
import { join, resolve } from "node:path";
// Controller
import DownloadController from "./controllers/download.ts";
import HomeController from "./controllers/home.ts";
import MusicController from "./controllers/music.ts";
// lib
import { getDataFromDatabase } from "./lib/database.ts";
import getLocalIPv4 from "./lib/ipv4.ts";
import CheckUserData from "./lib/env.ts"
import {
	getAllLocalFiles,
	getLocalFileById,
	getTrackByName,
	getTracks,
	getUserData,
	getUserDatas,
	writeLogs,
	writeUserData,
	writeUserDatas
} from "./db/index.ts";
// types
import { Repeat, Shuffle, SleepMode, Track, UserData } from "../shared/types.ts";
import type { AppRPCType, System } from "@/shared/types.ts";
import Player from "./music/index.ts";
import DiscordRPC from "./discord/index.ts";
import formatArtists from "../shared/utils/formatArtist.ts";

// app variables
const APP_ROOT = resolve("./");
const APP_ASSETS = resolve(APP_ROOT, "..", "Resources", "app")

const { isLocal, isDiscord, appPort, DiscordClientId } = await getDataFromDatabase(APP_ASSETS, "data", "system");
if ([isLocal, isDiscord, appPort].includes(null)) {
	await Utils.showMessageBox({
		type: "error",
		message: "Null Object, please reinstall app."
	})
	process.exit(1);
}

const userData = resolve(Utils.paths.userData, "..");
CheckUserData();

let appWin: BrowserWindow | null = null;
let appTray: Tray | null = null;
let discordRPC: DiscordRPC | null = null;
let player: Player | null = null;

const firstLoadCurrent = getUserData("current");
const current = {
	time: 0,
	duration: firstLoadCurrent.duration,
	isLived: firstLoadCurrent.isLived,
	isPlaying: false,
};

writeUserData("isLoading", true);

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
	const currentPlaying = getUserData("currentPlaying")
	if (isDiscord) {
		if (current.isPlaying) {
			discordRPC?.setMusic(currentPlaying, player, current);
		}
		else {
			discordRPC?.clearMusic();
		}
	}
};

const emitToFrontend = (message: string, payload: any) => {
	try {
		(appRPC as any)?.send(message, payload);
	} catch { }
};

const ytbTrackStart = "https://www.youtube.com/watch?v="

const play = () => {
	const currentPlaying = getUserData("currentPlaying");
	const url = currentPlaying.source === "youtube" ? `${ytbTrackStart}${currentPlaying.id}` : currentPlaying.id;
	player.player.play(url, currentPlaying.title, currentPlaying.thumbnail)
}

const folder = getUserData("folder");

player = new Player(userData, APP_ROOT, folder);
await player.init();

if (folder.length > 0 && isLocal) {
	player.local?.getfolder(folder);
}

player.player.on("exit", () => {
	appWin?.close();
	Utils.quit();
});

player.player.on("change-playState", (data: { isPlaying: boolean, time: number }) => {
	if (data.isPlaying !== undefined && data.isPlaying !== null) {
		current.isPlaying = data.isPlaying;
	}
	if (data.time !== undefined && data.time !== null) {
		current.time = data.time;
	}
	emitToFrontend("timeUpdate", { time: current.time, isPlaying: current.isPlaying });
	setDiscordRPC();
})

player.player.on("playing", async (data) => {
	if (!data) return;

	setDiscordRPC();
	let id = data.split(`${ytbTrackStart}`)[1];
	let isYoutube = true;
	if (!id || id === undefined || id === null) {
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
		id: track.id
	}
	writeUserData("currentPlaying", currentPlaying)
	emitToFrontend("currentTrackChanged", currentPlaying);
	if (isDiscord) {
		discordRPC?.setMusic(currentPlaying, player, { time: 0, duration: track.duration });
	}
	player.player.getQueue();
})

player.player.on("queue", async (data: { filename: string, playing: boolean }[]) => {
	try {
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
		const resultIds: string[] = [];

		resultIds.push(...playQueue, ...notinQueue, ...ids);

		if (resultIds.length < 20) {
			const [source, mode, id] = nextfrom.split(":");
			if (mode.includes("track")) {
				player.player.setRepeat(true);
				return;
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
						resultIds.push(...data.slice(0, 25 - resultIds.length).map(item => item.id))
					}
					else {
						let index = 0;
						if (resultIds.length > 0) {
							index = data.findIndex(item => item.id === resultIds[resultIds.length - 1]);
						}
						else {
							index = data.findIndex(item => item.id === currentTrack.split(ytbTrackStart)[1]);
						}
						resultIds.push(...Array.from({ length: 25 - resultIds.length + 1 }, (_, i) => data[(index + i) % data.length]).map(item => item.id))
					}
				}
			}
			else if (source === "local") {
				const localFiles = getAllLocalFiles();
				const otherTracks = localFiles.filter((localItem) => localItem.id !== currentTrack);
				if (otherTracks.length > 0) {
					if (shuffle === Shuffle.Enable) {
						for (let i = otherTracks.length - 1; i > 0; i--) {
							const j = Math.floor(Math.random() * (i + 1));
							[otherTracks[i], otherTracks[j]] = [otherTracks[j], otherTracks[i]];
						}
						resultIds.push(...otherTracks.slice(0, 25 - resultIds.length).map(item => item.id))
					}
					else {
						let index = 0;
						if (otherTracks.length > 0) {
							index = otherTracks.findIndex(item => item.id === currentTrack);
						}
						else {
							index = otherTracks.findIndex(item => item.id === currentTrack);
						}
						resultIds.push(...Array.from({ length: 25 - resultIds.length + 1 }, (_, i) => otherTracks[(index + i) % otherTracks.length]).map(item => item.id))
					}
				}
				else {
					player.player.setRepeat(true);
				}
			}
			writeUserData("nextfrom", nextfrom);
			let result: { url: string, thumbnail: string, title: string }[] = getTracks(resultIds).map(item => {
				return {
					url: (item.source === "youtube" ? ytbTrackStart : "") + item.id,
					thumbnail: item.thumbnail,
					title: item.name
				}
			});

			result = [...new Set(result.filter(item => item.url !== currentTrack))];

			await player.player.addTracks_test(result)
			const queueState = getUserDatas(["playQueue", "nextfrom", "playedTrack"]) as UserData;
			emitToFrontend("queueChanged", { playQueue: queueState.playQueue, nextfrom: queueState.nextfrom, playedTrack: queueState.playedTrack });
		}
	} catch (error) {
		console.error(error)
	}
})

player.player.on("duration-update", (duration) => {
	current.duration = duration * 1000;
	const temp = getUserData("current");
	if (temp.duration !== duration * 1000) {
		temp.duration = duration * 1000;
		writeUserData("current", temp);
	}
	emitToFrontend("playerStateChange", { isPlaying: current.isPlaying, isLoading: false, duration: current.duration, isLived: current.isLived });
});

player.player.on("is-live", (isLived) => {
	current.isLived = isLived;
	const temp = getUserData("current");
	temp.isLived = isLived;
	writeUserData("current", temp);
	emitToFrontend("playerStateChange", { isPlaying: current.isPlaying, isLoading: false, duration: current.duration, isLived: current.isLived });
});

player.player.on("loading", (data) => {
	emitToFrontend("playerStateChange", { isPlaying: current.isPlaying, isLoading: data, duration: current.duration, isLived: current.isLived });
});

player.player.on("ready", () => {
	emitToFrontend("playerStateChange", { isPlaying: current.isPlaying, isLoading: false, duration: current.duration, isLived: current.isLived });
});

const withSafeEncoding = <T extends Record<string, (...args: unknown[]) => unknown>>(handlers: T): T => {
	const wrappedHandlers: Partial<Record<keyof T, (...args: unknown[]) => unknown>> = {};

	for (const [key, handler] of Object.entries(handlers)) {
		if (typeof handler === "function") {
			wrappedHandlers[key as keyof T] = async (...args: unknown[]) => {
				const result = await handler(...args);
				if (result !== undefined) {
					return encodeURIComponent(JSON.stringify(result));
				}
				return result;
			};
		} else {
			wrappedHandlers[key as keyof T] = handler;
		}
	}

	return wrappedHandlers as T;
};

// @ts-ignore
const appRPC = BrowserView.defineRPC<AppRPCType>({
	maxRequestTime: 60 * 1000,
	handlers: {
		messages: {},
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
						});
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
						Utils.quit();
					}
					else {
						appWin?.close();
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
					player.player.togglePlayPause(!current.isPlaying);
					current.isPlaying = !current.isPlaying;
					emitToFrontend("playerStateChange", { isPlaying: current.isPlaying, isLoading: false, duration: current.duration, isLived: current.isLived });
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
							emitToFrontend("settingsChanged", { shuffle: getUserData("shuffle"), repeat: getUserData("repeat"), volume: data });
						}
						if (key === "repeat") {
							player.player.setRepeat(data === Repeat.One);
							emitToFrontend("settingsChanged", { shuffle: getUserData("shuffle"), repeat: data, volume: getUserData("volume") });
						}
						if (key === "shuffle") {
							emitToFrontend("settingsChanged", { shuffle: data, repeat: getUserData("repeat"), volume: getUserData("volume") });
						}
					} catch (error) {
						writeLogs([{ type: "error", message: `Error when writing user data with\nKey = ${key}\nValue = ${data}\n${error}` }]);
						return null;
					}
				},
				getPlayingData: async () => {
					const result = getUserDatas(["shuffle", "repeat", "isLoading", 'playedTrack', 'current']);
					return {
						...result,
						current,
						isPlaying: current.isPlaying
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
					const user = getUserDatas(["playQueue", "currentPlaying", "shuffle", "repeat", "playedTrack", "nextfrom"]) as UserData;
					user.playQueue = [];
					player.player.setRepeat(false);

					if (source === "youtube") {
						const track = await player.youtube.fetch_track([item.id])
						user.currentPlaying = {
							source, id: item.id, title: track[0].name, thumbnail: track[0].thumbnail, artist: formatArtists(track[0].artist)
						}
						current.duration = track[0].duration;
						user.nextfrom = `youtube:${type}:${id}`
					}
					else if (source === "local") {
						const track = getLocalFileById(item.id)
						user.currentPlaying = {
							source: track.source, id: item.id, title: track?.name, thumbnail: track?.thumbnail, artist: formatArtists(track?.artist)
						}
						current.duration = track?.duration;
						current.isLived = false;
						user.nextfrom = "local:local";
					}
					current.time = 0;
					user.repeat = user.repeat === Repeat.Disable ? Repeat.Disable : Repeat.All;

					user.playedTrack = Array.from(new Set([...user.playedTrack, user.currentPlaying.id]));
					writeUserDatas(user);
					emitToFrontend("currentTrackChanged", { source: user.currentPlaying.source, id: user.currentPlaying.id, title: user.currentPlaying.title, thumbnail: user.currentPlaying.thumbnail, artist: user.currentPlaying.artist });
					emitToFrontend("queueChanged", { playQueue: user.playQueue, nextfrom: user.nextfrom, playedTrack: user.playedTrack });
					emitToFrontend("settingsChanged", { shuffle: user.shuffle, repeat: user.repeat, volume: getUserData("volume") });
					play();
					return user.currentPlaying
				},
				seekTo: async (time: number) => {
					try {
						current.time = time;
						player.player.seekTo(time);
						emitToFrontend("timeUpdate", { time: current.time, isPlaying: current.isPlaying });
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
							const DiscordModule = await import("./discord/index.ts")
							discordRPC = new DiscordModule.default(DiscordClientId);
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
	if (appWin) {
		appWin?.show();
	}
	else {
		const { width, height } = Screen.getPrimaryDisplay().workArea;
		appWin = new BrowserWindow({
			title: "Kuumo app",
			url: "views://src/index.html",
			frame: { x: 0, y: 0, width, height },
			rpc: appRPC,
			titleBarStyle: "hidden",
		})
		appWin?.webview?.on("domReady", () => {
			appWin?.maximize();
			if (isFirstLoad) {
				play();
				isFirstLoad = false;
			}
		})
		appWin?.on("close", () => {
			appWin = null;
		})
	}
}

if (!isLocal) {
	writeUserDatas({
		folder: "",
		downloadQueue: [],
	})

	for (const binFile of ["ffmpeg", "ffprobe"]) {
		const file = Bun.file(resolve(APP_ROOT, `${binFile}.exe`));
		if (await file.exists()) {
			file.delete();
		}
	}
}

const host = getLocalIPv4();
const port = appPort;
const lockUrl = `http://${host}:${port}`;
try {
	const response = await fetch(lockUrl, {
		signal: AbortSignal.timeout(100)
	});

	if (response.ok) {
		writeLogs([{
			type: "error",
			message: `Error on sending tick to ${lockUrl}\n${response.statusText}`
		}]);

		process.stdout.write(`Error on sending tick to ${lockUrl}\n`, () => {
			process.exit(0);
		});
	}
} catch (error) {
	Bun.serve({
		port: port,
		hostname: host,
		fetch(_req) {
			openAppUI();
			return new Response("OK");
		}
	});
}

if (isDiscord && DiscordClientId.length > 0) {
	const DiscordModule = await import("./discord/index.ts")
	discordRPC = new DiscordModule.default(DiscordClientId);
	try {
		await discordRPC.connect();
	} catch { }
}

// Create Tray Menu
appTray = new Tray({
	title: "Music app",
	image: join(APP_ASSETS, "assets", "trayicon.ico"),
	template: true
});
appTray?.setMenu(getTrayMenu(true));
appTray?.on("tray-clicked", (e: { data: { action: string } }) => {
	const action = e?.data?.action ?? "nothing";

	if (action === "show") {
		openAppUI();
		appTray?.setMenu(getTrayMenu(true));
	}
	else if (action === "hide") {
		appWin?.close();
		appTray?.setMenu(getTrayMenu(false));
	}
	else if (action === "quit") {
		appWin?.close();
		Utils.quit();
	}
});
openAppUI();
// const now = Date.now()
// player.youtube.checkYoutubeTracks().then(() => { console.log(Date.now() - now) })