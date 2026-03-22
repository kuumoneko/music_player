import { BrowserView, BrowserWindow, MenuItemConfig, Tray, Updater, Utils } from "electrobun/bun";

import { config } from "dotenv";
import { resolve, join } from "node:path";

import DownloadController from "./controllers/download";
import HomeController from "./controllers/home";
import MusicController from "./controllers/music";
import PlayController from "./controllers/play";
import check_env from "./env";
import { getDataFromDatabase, writeDataToDatabase } from "./lib/database";
import Player from "./music/index.ts"
// import express from "express";
import getMainViewUrl from "./mode.ts";
import { Repeat, Shuffle, SleepMode } from "../shared/types.ts";
import Discord from "./discord/index.ts";
import { UserData } from "../shared/types.ts";
import forward from "./lib/forward.ts";
import backward from "./lib/backward.ts";
import type { AppRPCType, PlayerRPCType, UserProfile } from "@/shared/types.ts";
import { Track } from '../shared/types';

config();

let appWin: BrowserWindow | null = null;
let playWin: BrowserWindow | null = null;
let appTray: Tray | null = null;
let discordRPC: Discord | null = null;
let log: string[] = [];

let isDevMode: boolean = await getMainViewUrl();
const APP_PORT = process.env["APP_PORT"] ?? 3000;
const MainViewPort = process.env["MAIN_PORT"] ?? 5006;
const PlayerViewPort = process.env["PLAYER_PORT"] ?? 5005;

try {
	Bun.serve({
		port: APP_PORT,
		fetch(_req: any) {
			console.log("A second instance tried to open!");

			if (appWin) {
				appWin?.show();
				appWin?.focus();
				appWin?.maximize();
			}
			else {
				appWin = new BrowserWindow({
					title: "Music app", url: `http://localhost:${MainViewPort}`, rpc: appRPC, titleBarStyle: "hidden", preload: `window.addEventListener('contextmenu', (e) => {e.preventDefault();}, false);`
				})
			}

			return new Response("OK");
		}
	});
} catch (error: any) {
	if (error.code === 'EADDRINUSE') {
		console.log("App is already running. Quitting this instance.");
		process.exit(0);
	} else {
		console.error("Failed to acquire single instance lock:", error);
	}
}

export const APP_ROOT = resolve("./", "..", "Resources", "app");
export const userData = resolve(Utils.paths.userData, "..");
export const Discord_CLient_ID = process.env["CLIENT_ID"];

check_env(userData);

let profile: UserProfile = await getDataFromDatabase(userData, "data", "profile");
let user: UserData = await getDataFromDatabase(userData, "data", "user");
let player: Player | null = null;
user.isPlaying = false;
user.current = {
	time: 0,
	duration: user.current.duration
}


setInterval(() => {
	writeDataToDatabase(userData, "data", "profile", profile);
	writeDataToDatabase(userData, 'data', 'user', user);
	writeDataToDatabase(userData, 'data', 'tracks', player.youtube.tracks);
	writeDataToDatabase(userData, 'data', 'playlists', player.youtube.playlists);
	writeDataToDatabase(userData, 'data', 'artists', player.youtube.artists);
	writeDataToDatabase(userData, 'data', 'log', log);


	if (user.current.duration !== 0) {
		discordRPC.setMusic(user.currentPlaying, userData, player, user.current);
	}
	else {
		discordRPC.clearMusic();
	}
}, 10 * 1000);

setInterval(() => {
	(playWin.webview.rpc as any).request.setVolume(user.volume)
}, 100)

player = new Player(userData, APP_ROOT);
if (profile.folder.length > 0) {
	player.local.getfolder(profile.folder);
}

if (Discord_CLient_ID) {
	discordRPC = new Discord(Discord_CLient_ID);
}

const addLog = (message: string) => {
	const now = new Date();
	const date = `${now.getDate()}-${now.getMonth() + 1}-${now.getFullYear()}`;
	const time = `${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`;
	log.push(`[${date} ${time}]`);
	log.push(message);
	log.push("");

	console.log(message)
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
					// console.log(result)
					return result;
				} catch (error) {
					addLog(error);
					return null;
				}
			},
			getUserPlaylists: async () => {
				try {
					// later
				} catch (error) {
					addLog(error);
					return null;
				}
			},
			getUserArtists: async () => {
				try {
					// later
				} catch (error) {
					addLog(error);
					return null;
				}
			},
			getProfileData: async (key: keyof UserProfile) => { return profile[key as keyof UserProfile] },
			setProfileData: async ({ key, data }: { key: keyof UserProfile, data: any }) => {
				try {
					if (key === "folder") {
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
					return await DownloadController(player, userData);
				} catch (error) {
					addLog(error);
					return null;
				}
			},
			getDownloadStatus: async () => {
				return player.status;
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
					appWin?.close();
					appWin = null;
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

					if (key === "repeat" && data === Repeat.One) {
						(playWin.webview.rpc as any).request.setIsRepeat(true);
					}
					else if (key === "repeat") {
						(playWin.webview.rpc as any).request.setIsRepeat(false);
					}

				} catch (error) {
					addLog(error);
					return null;
				}
			},
			next: async () => {
				try {
					// console.log(Math.random() * 100)
					// console.log(user.nextfrom.next[0])
					await forward(player, user);
					// console.log(user.nextfrom.next[0]);
					// console.log(user.currentPlaying);

					(playWin.webview.rpc as any).request.playTrack(user.currentPlaying)
				} catch (error) {
					addLog(error);
					return null;
				}
			},
			previous: async () => {
				try {
					await backward(player, user);
					(playWin.webview.rpc as any).request.playTrack(user.currentPlaying)
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
						if (type === "playlist") {
							otherTracks = (await player.youtube.fetch_playlist(id)).tracks;
						}
						else if (type === "artist") {
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
						source, id: item.id, title: track?.name, thumbnail: track?.thumbnail, artist: track?.artist.map((item: any) => item.name).join(", ")
					}
					user.current.duration = track?.duration;
					user.nextfrom = {
						from: `local:${item.id}`,
						next: player.local.data.slice(0, 20)
					}
				}
				user.current.time = 0;
				user.repeat = user.repeat === Repeat.Disable ? Repeat.Disable : Repeat.All;
				user.playedTrack = Array.from(new Set([...user.playedTrack, user.currentPlaying.id]));
				(playWin.webview.rpc as any).request.playTrack({
					source: user.currentPlaying.source,
					id: user.currentPlaying.id,
					title: user.currentPlaying.title,
					thumbnail: user.currentPlaying.thumbnail,
					artist: user.currentPlaying.artist
				});
				(playWin.webview.rpc as any).request.setIsRepeat(user.repeat as any === Repeat.One);
				return {
					source: user.currentPlaying.source,
					id: user.currentPlaying.id,
					title: user.currentPlaying.title,
					thumbnail: user.currentPlaying.thumbnail,
					artist: user.currentPlaying.artist
				}
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
			isHasDiscordRPC: async () => { return discordRPC.rpc.user.username ?? false },
			connectDiscordRPC: async () => {
				try {
					discordRPC = new Discord(Discord_CLient_ID);
				} catch (error) {
					addLog(error);
					return null;
				}
			},
			isAutoStart: async () => { return Bun.argv.includes("--autostart") },
			toggleAutoStart: async () => {
				try {
					const i = process.argv.indexOf("--autostart");
					i > -1 ? process.argv.splice(i, 1) : process.argv.push("--autostart");
				} catch (error) {
					addLog(error);
					return null;
				}
			},
			setFolder: async () => {
				try {
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
				} catch (error) {
					addLog(error);
					return null;
				}
			},
			// getUser: async () => {

			// },
			// login: async () => {
			// 	try {
			// 		const result = await LoginWithGoogle(APP_ROOT);
			// 		const { personal } = await getDataFromDatabase(APP_ROOT, "data", "system");
			// 		YTBuser = new User({
			// 			accessToken: {
			// 				token: result.access_token,
			// 				expires: new Date().getTime() + result.expires_in * 1000
			// 			},
			// 			refreshToken: {
			// 				token: result.refresh_token,
			// 				expires: new Date().getTime() + result.refresh_token_expires_in * 1000
			// 			},
			// 			tokenType: result.token_type,
			// 			client: {
			// 				id: personal.client_id,
			// 				secret: personal.client_secret,
			// 				key: personal.key
			// 			}
			// 		})

			// 		const userdata = await YTBuser.getUser();
			// 		return userdata
			// 	} catch (error) {
			// 		addLog(error);
			// 		return null;
			// 	}
			// }

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
						// console.log(user.currentPlaying);
						await forward(player, user);
						// console.log(user.currentPlaying);
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

appTray = new Tray({
	title: "Music app",
	image: join(APP_ROOT, "assests", "trayicon.ico"),
	template: true
})

appTray?.setMenu(getTrayMenu(true))

appTray?.on("tray-clicked", (e: any) => {
	const action = e?.data?.action ?? "nothing";

	switch (action) {
		case "show":
			appWin = new BrowserWindow({
				title: "Music app", url: `http://localhost:${MainViewPort}`, rpc: appRPC, titleBarStyle: "hidden"
			})
			appTray.setMenu(getTrayMenu(true));
			break;
		case "hide":
			user.QuitonClose = false;
			appWin?.close();
			appWin = null;
			appTray.setMenu(getTrayMenu(false));
			break;

		case "quit":
			Utils.quit();
			break;
	}
})

Bun.serve({
	port: MainViewPort,
	async fetch(req) {
		const url = new URL(req.url);

		// 1. Handle the root route "/"
		if (url.pathname === "/") {
			return new Response(Bun.file(join(APP_ROOT, "views", "src", "mainview", "index.html")));
		}

		// 2. Handle static files (Replacing express.static)
		const filePath = join(APP_ROOT, "views", url.pathname);
		const file = Bun.file(filePath);

		if (await file.exists()) {
			return new Response(file);
		}

		// 3. Fallback 404
		return new Response("Not Found", { status: 404 });
	},
});

Bun.serve({
	port: PlayerViewPort,
	async fetch(req) {
		const url = new URL(req.url);

		if (url.pathname === "/music") {
			const filePath = url.searchParams.get("path");

			if (!filePath) {
				return new Response("Missing path parameter", {
					status: 400,
					headers: { "Access-Control-Allow-Origin": "*" }
				});
			}

			// Load the file using Bun's native file handler
			const file = Bun.file(join(player.download_folder, filePath));
			const exists = await file.exists();

			if (!exists) {
				return new Response("File not found on disk", {
					status: 404,
					headers: { "Access-Control-Allow-Origin": "*" }
				});
			}

			// 🎵 Return the streamed file. Bun automatically handles 'Range' headers for scrubbing!
			return new Response(file, {
				headers: {
					"Access-Control-Allow-Origin": "*",
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
	},
});

appWin = new BrowserWindow({
	title: "Music app", url: `http://localhost:${MainViewPort}`, rpc: appRPC, titleBarStyle: "hidden",
	// preload: `window.addEventListener('contextmenu', (e) => {e.preventDefault();}, false);`
})

playWin = new BrowserWindow({
	url: `http://localhost:${PlayerViewPort}`, hidden: true, rpc: playRPC, frame: {
		x: 0, y: 0, height: 800, width: 600
	}
})

appWin?.webview?.on("dom-ready", () => {
	appWin.maximize();
	appWin.focus();
	if (isDevMode) {
		playWin.webview.openDevTools();
	}
})

playWin?.webview?.on("dom-ready", () => {
	if (isDevMode) {
		playWin.webview.openDevTools();
	}
})