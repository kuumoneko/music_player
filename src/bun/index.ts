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
import { checkBinFolder, checkUserDataFolder } from "./lib/env.ts"
// Features
import Player from "./music/index.ts"
import Discord from "./discord/index.ts";
// types
import { Repeat, Shuffle, SleepMode, Track, UserData } from "../shared/types.ts";
import type { AppRPCType, PlayerRPCType, System, UserProfile } from "@/shared/types.ts";

config();

// app variables
const APP_ROOT = resolve("./", "..", "Resources", "app");
const { isLocal, isDiscord, appPort, playerPort } = await getDataFromDatabase(APP_ROOT, "data", "system");
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
let Discord_CLient_ID: string | null = null;

const userData = resolve(Utils.paths.userData, "..");
const PlayerViewPort = playerPort;
await checkUserDataFolder(userData);

let profile: UserProfile = await getDataFromDatabase(userData, "data", "profile");
let user: UserData = await getDataFromDatabase(userData, "data", "user");
let player: Player | null = null;
user.isPlaying = false;
user.current = {
	time: 0,
	duration: user.current.duration
}

const addLog = (message: string) => {
	const now = new Date();
	const date = `${now.getDate()}-${now.getMonth() + 1}-${now.getFullYear()}`;
	const time = `${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`;
	log.push(`[${date} ${time}]`);
	log.push(message);
	log.push("");
	writeDataToDatabase(userData, "data", "log", log.join("\n"));

	console.error(message)
}

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
	if (isDiscord) {
		discordRPC.setMusic(user.currentPlaying, userData, player, user.current, user.isPlaying);
	}
	if (!playWin) return;
	(playWin.webview.rpc as any).request.playTrack(user.currentPlaying)
}
player = new Player(userData, APP_ROOT);
if (profile.folder.length > 0 && isLocal) {
	player?.local?.getfolder(profile.folder);
}
// @ts-ignore
const appRPC = BrowserView.defineRPC<AppRPCType>({
	maxRequestTime: 60 * 1000,
	handlers: {
		requests: {
			getMusicData: async ({ type, id }: { type: "youtube" | "local", id: string }) => {
				try {
					const result = await MusicController(player, {
						source: "youtube",
						type: type,
						id: id,
						query: "",
						mode: ""
					})
					return result
				} catch (error) {
					addLog(error);
					return null;
				}
			},
			getLocalfile: async () => {
				return player.local.data
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
					addLog(error);
					return null;
				}
			},
			getHomeData: async () => {
				try {
					const result = await HomeController(player, profile.pin);
					return result;
				} catch (error) {
					addLog(error);
					return null;
				}
			},
			getSystem: (key: keyof System) => { return key === "youtubeApiKeys" ? null : key === "isDiscord" ? isDiscord : isLocal },
			getProfileData: async (key: keyof UserProfile) => { return key === "folder" && !isLocal ? null : profile[key as keyof UserProfile] },
			setProfileData: async ({ key, data }: { key: keyof UserProfile, data: any }) => {
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

						profile.folder = value[0];
						player.local.getfolder(value[0]);

						return value[0]
					}
					profile[key] = data;
				} catch (error) {
					addLog(error);
					return null;
				}
			},
			downloadMusic: async () => {
				try {
					if (profile.download.length === 0) {
						throw new Error("No download queue");
					}
					if (!isLocal) {
						throw new Error("User dont set this app has local file")
					}
					return await DownloadController(player, userData);
				} catch (error) {
					addLog(error);
					return null;
				}
			},
			getDownloadStatus: async () => {
				return !isLocal ? null : player.status;
			},
			close: async () => {
				if (user.QuitonClose) {
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
				user.QuitonClose = !user.QuitonClose;
			},
			isQuitonClose: async () => { return user.QuitonClose; },
			togglePlayPause: async () => {
				try {
					user.isPlaying = !user.isPlaying;
					(playWin.webview.rpc as any).request.togglePlayPause();
				} catch (error) {
					addLog(error);
					return null;
				}
			},
			getUserData: async (key: keyof UserData) => {
				return user[key as keyof UserData];
			},
			setUserData: async ({ key, data }: { key: keyof UserData, data: any }) => {
				try {
					(user as any)[key] = data;

					if (key === "repeat") {
						(playWin.webview.rpc as any).request.setIsRepeat(data === Repeat.One);
					}

				} catch (error) {
					addLog(error);
					return null;
				}
			},
			getPlayingData: () => {
				return {
					shuffle: user.shuffle,
					repeat: user.repeat,
					isPlaying: user.isPlaying,
					isLoading: user.isLoading,
					playedTrack: user.playedTrack?.length > 0,
					current: user.current
				}
			},
			next: async () => {
				try {
					await forward(player, user);
					play();
				} catch (error) {
					addLog(error);
					return null;
				}
			},
			previous: async () => {
				try {
					await backward(player, user);
					play();
				} catch (error) {
					addLog(error);
					return null;
				}
			},
			play: async ({ item, source, type, id }: { item: Track, source: "youtube" | "local", type: "track" | "playlist" | "artist", id: string }) => {
				user.queue = [];
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
					const track = player.local.data.find((localItem) => localItem.id === item.id);
					user.currentPlaying = {
						source, id: item.id, title: track?.name, thumbnail: track?.thumbnail, artist: track?.artist.map((item: any) => item.name).join(", "), index: track?.index
					}
					user.current.duration = track?.duration;
					user.nextfrom = {
						from: `local:local`,
						next: player.local.data.slice(0, 20)
					}
				}
				user.current.time = 0;
				user.repeat = user.repeat === Repeat.Disable ? Repeat.Disable : Repeat.All;

				user.playedTrack = Array.from(new Set([...user.playedTrack, user.currentPlaying.id]));
				(playWin.webview.rpc as any).request.playTrack(user.currentPlaying);
				if (user.nextfrom.next.length < 2) {
					(playWin.webview.rpc as any).request.setIsRepeat(true);
				}
				else {
					(playWin.webview.rpc as any).request.setIsRepeat(user.repeat as any === Repeat.One);
				}
				return user.currentPlaying
			},
			seekTo: async (time: number) => {
				try {
					user.current.time = time;
					(playWin.webview.rpc as any).request.seekTo(time);
				} catch (error) {
					addLog(error);
					return null;
				}
			},
			setSleep: async (mode: SleepMode) => {
				try {
					(playWin.webview.rpc as any).request.setSleep(mode);
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
					return discordRPC.rpc.user.username ?? false
				}
				else return null;
			},
			connectDiscordRPC: async () => {
				try {
					if (isDiscord)
						discordRPC = new Discord(Discord_CLient_ID);
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
					const result = await PlayController(player, user);
					return result
				} catch (error) {
					addLog(error);
					return null;
				}
			},
			endTrack: async () => {
				try {
					try {
						await forward(player, user);
						discordRPC.setMusic(user.currentPlaying, userData, player, user.current, user.isPlaying);
						(playWin.webview.rpc as any).request.playTrack(user.currentPlaying)
					} catch (error) {
						addLog(error);
						return null;
					}
				} catch (error) {
					addLog(error);
					return null;
				}
			},
			sleep: async () => { appWin?.close(); },
			setLoading: (isLoading: boolean) => {
				user.isLoading = isLoading;
			},
			setcurrentTime: (time: number) => {
				user.current.time = time;
			},
			setDuration: (duration: number) => {
				user.current.duration = duration;
			},
			setIsPlaying: (isPlaying: boolean) => {
				user.isPlaying = isPlaying;
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

await checkBinFolder(APP_ROOT, isLocal, profile);

const host = getLocalIPv4();
const port = appPort;
const lockUrl = `http://${host}:${port}`
try {
	const response = await fetch(lockUrl);

	if (response.ok) {
		console.log("App is already running. Notified the first instance.");
		process.exit(0);
	}
} catch (error: any) {
	console.log("No existing instance found. Starting primary instance...");

	Bun.serve({
		port: port,
		hostname: host,
		fetch(_req: any) {
			console.log("A second instance tried to open!");
			openAppUI();
			return new Response("OK");
		}
	});

	console.log(`Primary instance listening on ${lockUrl}`);
}

if (isDiscord) {
	Discord_CLient_ID = process.env["CLIENT_ID"] ?? "";
	if (Discord_CLient_ID?.length > 0) {
		discordRPC = new Discord(Discord_CLient_ID);
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

				const fileName = player.local.data.find((item: Track) => item.index === Number(filePath)).id
				let file: any;
				file = Bun.file(fileName);
				const Firstexists = await file.exists();
				if (!Firstexists) {
					file = Bun.file(resolve(profile.folder, fileName));
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

