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
import PlayController from "./controllers/play.ts";
// lib
import { getDataFromDatabase, writeDataToDatabase } from "./lib/database.ts";
import forward from "./lib/forward.ts";
import backward from "./lib/backward.ts";
import getLocalIPv4 from "./lib/ipv4.ts";
import CheckUserData from "./lib/env.ts"
import consoleLog, { LogType } from "./lib/log.ts";
import { getAllLocalFiles, getLocalFileByIndex, getUserData, getUserDatas, writeUserData, writeUserDatas } from "./db/index.ts";
// Features
import Player from "./music/index.ts"
import Discord from "./discord/index.ts";
// types
import { Repeat, Shuffle, SleepMode, Track, UserData } from "../shared/types.ts";
import type { AppRPCType, PlayerRPCType, System } from "@/shared/types.ts";

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
let playWin: BrowserWindow | null = null;
let appTray: Tray | null = null;
let discordRPC: Discord | null = null;
let log: string[] = [];

const userData = resolve(Utils.paths.userData, "..");
const PlayerViewPort = playerPort;
CheckUserData();

let player: Player | null = null;

() => {
	const current = getUserData("current");
	writeUserData("isPlaying", false);

	writeUserData("current", {
		time: 0, duration: current.duration,
		isLived: current.isLived,
	})
};

function formatBytes(bytes: number, decimals = 2) {
	if (bytes === 0) return '0 Bytes';

	const k = 1024;
	const dm = decimals < 0 ? 0 : decimals;
	const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

	const i = Math.floor(Math.log(bytes) / Math.log(k));

	return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

const addLog = (message: string) => {
	const now = new Date();
	const date = `${now.getDate()}-${now.getMonth() + 1}-${now.getFullYear()}`;
	const time = `${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`;
	log.push(`[${date} ${time}]`);
	log.push(message);
	log.push("");
	writeDataToDatabase(userData, "data", "log", log.join("\n"));
	consoleLog(message, LogType.Error);
}

process.on("uncaughtException", (error) => {
	Utils.showMessageBox({
		type: "error",
		title: error.name,
		message: error.message,
		detail: error.cause as string + " " + error.stack
	})
	addLog(error.cause + " " + error.message)
})

process.on('unhandledRejection', (reason, promise) => {
	consoleLog(`Unhandled Promise Rejection at: ${promise}`, LogType.Error);
	consoleLog(`Reason: ${reason}`, LogType.Error);
	process.exit(1);
});

process.on("beforeExit", (code: number) => {
	addLog(String(code))
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

const play = () => {
	const user = getUserDatas(["currentPlaying", "current", "isPlaying"])
	if (isDiscord) {
		discordRPC?.setMusic(user.currentPlaying,  player, user.current, user.isPlaying);
	}
	if (!playWin) return;
	(playWin.webview.rpc as any).request.playTrack(user.currentPlaying).catch(() => consoleLog("Error on sending rpc", LogType.Error))
}
player = new Player(userData, APP_ROOT);
() => {
	const folder = getUserData("folder");
	if (folder.length > 0 && isLocal) {
		player.local.getfolder(folder);
	}
}

// @ts-ignore
const appRPC = BrowserView.defineRPC<AppRPCType>({
	maxRequestTime: 60 * 1000,
	handlers: {
		requests: {
			getMusicData: async ({ source, type, id }: { source: "youtube" | "local", type: string, id: string }) => {
				try {
					consoleLog(`Get music data ${source} ${type} ${id}`, LogType.Debug);
					const result = await MusicController(player, {
						source: source,
						type: type,
						id: id,
						query: "",
						mode: ""
					})
					consoleLog(`Done task get music data ${source} ${type} ${id} with ${formatBytes(JSON.stringify(result).length)} data will be transfer`, LogType.Debug);
					return result
				} catch (error) {
					addLog(error);
					return null;
				}
			},
			getLocalfile: async () => {
				try {
					const result = getAllLocalFiles();
					return result;
				} catch (error) {
					addLog(error);
					return null;
				}
			},
			searchMusic: async ({ type, query }: { type: "video" | "playlist" | "artist", query: string }) => {
				try {
					consoleLog(`Get search data ${type} ${query}`, LogType.Debug);
					const result = await MusicController(player, {
						source: "youtube",
						id: "",
						type: type,
						query: query, mode: "search"
					})
					consoleLog(`Done task get search data ${type} ${query} with ${formatBytes(JSON.stringify(result).length)} data will be transfer`, LogType.Debug);
					return result
				} catch (error) {
					addLog(error);
					return null;
				}
			},
			getHomeData: async () => {
				try {
					consoleLog(`Get home data`, LogType.Debug);
					const pin = getUserData("pin")
					const result = await HomeController(player, pin);
					consoleLog(`Done task get Home data with ${formatBytes(JSON.stringify(result).length)} data will be transfer`, LogType.Debug);
					return result;
				} catch (error) {
					addLog(error);
					return null;
				}
			},
			getSystem: (key: keyof System) => { return key === "youtubeApiKeys" ? null : key === "isDiscord" ? isDiscord : isLocal },
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
					addLog(error);
					return null;
				}
			},
			getDownloadStatus: async () => {
				return !isLocal ? null : player.status;
			},
			close: async () => {
				const QuitonClose = getUserData("QuitonClose")
				if (QuitonClose) {
					appWin?.close();
					appWin = null;
					playWin?.close();
					Utils.quit();
					process.exit(0)
				}
				else {
					try {
						appWin?.close();
						appWin = null;
					} catch (error) {
						appWin?.hide();
					}
					appTray?.setMenu(getTrayMenu(false))
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
				try {

					writeUserData("isPlaying", !getUserData("isPlaying"));

					(playWin.webview.rpc as any).request.togglePlayPause().catch(() => consoleLog("Error on sending rpc", LogType.Error));
				} catch (error) {
					addLog(error);
					return null;
				}
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

					if (key === "repeat") {
						(playWin.webview.rpc as any).request.setIsRepeat(data === Repeat.One).catch(() => consoleLog("Error on sending rpc", LogType.Error));
					}

				} catch (error) {
					addLog(error);
					return null;
				}
			},
			getPlayingData: () => {
				const result = getUserDatas(["shuffle", "repeat", "isPlaying", "isLoading", 'playedTrack', 'current']);
				return result
			},
			next: async () => {
				try {
					await forward(player);
					play();
				} catch (error) {
					addLog(error);
					return null;
				}
			},
			previous: async () => {
				try {
					await backward(player);
					play();
				} catch (error) {
					addLog(error);
					return null;
				}
			},
			play: async ({ item, source, type, id }: { item: Track, source: "youtube" | "local", type: "track" | "playlist" | "artist", id: string }) => {
				const user = getUserDatas(["playQueue", "currentPlaying", "current", "shuffle", "repeat", "playedTrack", "nextfrom"])
				user.playQueue = [];
				if (source === "youtube") {
					const track = await player.youtube.fetch_track([item.id])
					user.currentPlaying = {
						source, id: item.id, title: track[0].name, thumbnail: track[0].thumbnail, artist: track[0].artist.map((item) => item.name).join(", ")
					}
					user.current.duration = track[0].duration;
					if (type === "track") {
						user.nextfrom = {
							from: `youtube:track:${id}`,
							next: [
								track[0]
							]
						}
					}
					else {
						let otherTracks = [];
						if (type.includes("playlist")) {
							otherTracks = (await player.youtube.fetch_playlist(id)).tracks;
						}
						else if (type.includes("artist")) {
							otherTracks = (await player.youtube.fetch_artist(id)).tracks;
						}
						if (user.shuffle === Shuffle.Enable) {
							for (let i = otherTracks.length - 1; i > 0; i--) {
								const j = Math.floor(Math.random() * (i + 1));
								[otherTracks[i], otherTracks[j]] = [otherTracks[j], otherTracks[i]];
							}
						}
						user.nextfrom = {
							from: `youtube:${type}:${id}`,
							next: otherTracks.slice(0, 20)
						}
					}
				}
				else if (source === "local") {
					const localFiles = getAllLocalFiles();
					const track = localFiles.find((localItem) => localItem.id === item.id);
					user.currentPlaying = {
						source, id: item.id, title: track?.name, thumbnail: track?.thumbnail, artist: track?.artist.map((item: any) => item.name).join(", "), index: track?.index
					}
					user.current.duration = track?.duration;
					user.current.isLived = false;
					user.nextfrom = {
						from: `local:local`,
						next: localFiles.slice(0, 20)
					}
				}
				user.current.time = 0;
				user.repeat = user.repeat === Repeat.Disable ? Repeat.Disable : Repeat.All;

				user.playedTrack = Array.from(new Set([...user.playedTrack, user.currentPlaying.id]));
				(playWin.webview.rpc as any).request.playTrack(user.currentPlaying).catch(() => consoleLog("Error on sending rpc", LogType.Error));
				if (user.nextfrom.next.length < 2) {
					(playWin.webview.rpc as any).request.setIsRepeat(true).catch(() => consoleLog("Error on sending rpc", LogType.Error));
				}
				else {
					(playWin.webview.rpc as any).request.setIsRepeat(user.repeat as any === Repeat.One).catch(() => consoleLog("Error on sending rpc", LogType.Error));
				}
				writeUserDatas(user);
				return user.currentPlaying
			},
			seekTo: async (time: number) => {
				try {
					const current = getUserData("current");
					current.time = time;
					writeUserData("current", current);
					(playWin.webview.rpc as any).request.seekTo(time);
				} catch (error) {
					addLog(error);
					return null;
				}
			},
			setSleep: async (mode: SleepMode) => {
				try {
					(playWin.webview.rpc as any).request.setSleep(mode).catch(() => consoleLog("Error on sending rpc", LogType.Error));
				} catch (error) {
					addLog(error);
					return null;
				}
			},
			checkUpdate: async () => {
				try {
					const { version } = await Updater.getLocallocalInfo();
					const { updateAvailable } = await Updater.checkForUpdate();
					return updateAvailable === true ? updateAvailable : version;
				} catch (error) {
					addLog(error);
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
					addLog(error);
					return null;
				}
			},
		}
	}
})

// @ts-ignore
const playRPC = BrowserView.defineRPC<PlayerRPCType>({
	maxRequestTime: 60 * 1000,
	handlers: {
		requests: {
			getTrack: async () => {
				try {
					const folder = getUserData("folder")
					const result = await PlayController(folder);
					return result
				} catch (error) {
					addLog(error);
					return null;
				}
			},
			endTrack: async () => {
				try {
					await forward(player);
					const user = getUserDatas(["currentPlaying", 'current', 'isPlaying'])
					discordRPC?.setMusic(user.currentPlaying,  player, user.current, user.isPlaying);
					return user.currentPlaying;
				} catch (error) {
					addLog(error);
					return null;
				}
			},
			sleep: async () => { appWin?.close(); },
			setLoading: (isLoading: boolean) => {
				writeUserData("isLoading", isLoading)
			},
			setcurrentTime: (time: number) => {
				writeUserData("current", {
					...getUserData("current"),
					time: time
				})
			},
			setDuration: (duration: number) => {
				writeUserData("current", {
					...getUserData("current"),
					duration: duration
				})
			},
			setIsPlaying: (isPlaying: boolean) => {
				writeUserData("isPlaying", isPlaying);
			},
			setisLive: (isLived: boolean) => {
				writeUserData("current", {
					...getUserData("current"),
					isLived: isLived
				})
			}
		}
	}
})

const openAppUI = () => {
	if (appWin) {
		appWin?.show();
	}
	else {
		appWin = new BrowserWindow({
			title: "Music app", url: "views://src/mainview/index.html", rpc: appRPC, titleBarStyle: "hidden",
			preload: `window.addEventListener('contextmenu', (e) => {e.preventDefault();}, false);`
		})
		appWin?.webview?.on("dom-ready", () => {
			appWin?.maximize();
			appWin?.focus();
		})
	}
}

if (!isLocal) {
	writeUserDatas({
		folder: "",
		downloadQueue: [],
	})

	for (const binFile of ["ffmpeg", "ffprobe", "yt-dlp"]) {
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
		consoleLog("Error on sending rpc", LogType.Error)
		consoleLog("App is already running. Notified the first instance.", LogType.Info);
		process.exit(0);
	}
} catch (error: any) {
	consoleLog("No existing instance found. Starting primary instance...", LogType.Info);

	Bun.serve({
		port: port,
		hostname: host,
		fetch(_req: any) {
			consoleLog("A second instance tried to open!", LogType.Info);
			openAppUI();
			return new Response("OK");
		}
	});

	consoleLog(`Primary instance listening on ${lockUrl}`, LogType.Info);
}

if (isDiscord && DiscordClientId.length > 0) {
	discordRPC = new Discord(DiscordClientId);
	try {
		await discordRPC.connect();
	} catch (error) {
		consoleLog("Discord Client is not running", LogType.Info)
	}
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
		openAppUI();
		appTray?.setMenu(getTrayMenu(true));
	}
	else if (action === "hide") {
		try {
			appWin?.close();
			appWin = null;
		} catch (error) {
			appWin?.hide();
		}
		appTray?.setMenu(getTrayMenu(false));
	}
	else if (action === "quit") {
		appWin?.close();
		playWin?.close();
		Utils.quit();
		process.exit(0);
	}
});

openAppUI();

// Create Player Windows
Bun.serve({
	port: PlayerViewPort,
	async fetch(req) {
		try {
			const url = new URL(req.url);

			if (url.pathname === "/music") {
				const filePath = url.searchParams.get("path");

				if (!filePath) {
					return new Response("Missing path parameter", {
						status: 400,
						headers: { "Access-Control-Allow-Origin": "*" }
					});
				}
				const fileName = getLocalFileByIndex(Number(filePath)).id
				let file: any;
				file = Bun.file(fileName);
				const Firstexists = await file.exists();
				if (!Firstexists) {
					file = Bun.file(resolve(getUserData("folder"), fileName));
					const Secexists = await file.exists();
					if (!Secexists) {
						return new Response("File not found on disk", {
							status: 404,
							headers: { "Access-Control-Allow-Origin": "*" }
						});
					}
				}

				return new Response(file, {
					headers: {
						"Access-Control-Allow-Origin": "*",
						"Accept-Ranges": "bytes",
						"Content-Length": file.size.toString(),
						"Content-Type": file.type || "audio/mpeg",
					}
				});
			}

			if (url.pathname === "/") {
				return new Response(Bun.file(join(APP_ROOT, "views", "src", "player", "index.html")));
			}

			const filePath = join(APP_ROOT, "views", url.pathname);
			const file = Bun.file(filePath);

			if (await file.exists()) {
				return new Response(file);
			}

			return new Response("Not Found", { status: 404 });
		} catch (error) {
			addLog(error)
		}
	},
});
playWin = new BrowserWindow({
	url: `http://localhost:${PlayerViewPort}`, hidden: true, rpc: playRPC
})
playWin?.webview?.on("dom-ready", () => {
	playWin.hide();
})

setInterval(async () => {
	if (isDiscord === true && discordRPC?.isReady === true) {
		const user = getUserDatas(["current", 'currentPlaying', 'isPlaying'])
		if (user.current.duration !== 0) {
			discordRPC?.setMusic(user.currentPlaying,  player, user.current, user.isPlaying);
		}
		else {
			discordRPC?.clearMusic();
		}
	}
}, 10 * 1000);