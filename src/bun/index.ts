import { BrowserView, BrowserWindow, MenuItemConfig, Tray, Updater, Utils } from "electrobun/bun";

import { config } from "dotenv";
import path, { resolve } from "node:path";

import DownloadController from "./controllers/download";
import HomeController from "./controllers/home";
import ImportControllers from "./controllers/import";
import MusicController from "./controllers/music";
import PlayController from "./controllers/play";
import ProfileController from "./controllers/profile";
import check_env from "./env";
import { getDataFromDatabase, writeDataToDatabase } from "./lib/database";
import Player from "./music/index.ts"
import { Client, SetActivity } from "@xhayper/discord-rpc"
import { ActivityType } from "discord-api-types/v10";
import express from "express";

config();

let win: BrowserWindow | null;
let tray: Tray | null
let rpc: Client | null
try {
	// Try to start a server on the lock port
	Bun.serve({
		port: process.env.APP_PORT ?? 3000,
		fetch(_req: any) {
			// The second instance can hit this endpoint to tell the first instance to wake up
			console.log("A second instance tried to open!");

			// If you have a reference to your main window, focus it here:
			if (win) win.focus();

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

const DEV_SERVER_URL = `http://localhost:${process.env.PORT}`;

export const APP_ROOT = resolve("./", "..", "Resources", "app");
export const userData = path.resolve(Utils.paths.userData, "..");
export const Discord_CLient_ID = process.env.CLIENT_ID;

// Check if Vite dev server is running for HMR
async function getMainViewUrl(): Promise<string> {
	const channel = await Updater.localInfo.channel();
	if (channel === "dev") {
		try {
			await fetch(DEV_SERVER_URL, { method: "HEAD" });
			console.log(`HMR enabled: Using Vite dev server at ${DEV_SERVER_URL}`);
			return DEV_SERVER_URL;
		} catch {
			console.log(
				"Vite dev server not running. Run 'bun run dev:hmr' for HMR support.",
			);
		}
	}

	const app = express();
	app.use(express.static(path.join(APP_ROOT, "views", "mainview")));
	app.get("/", (_req, res) => {
		res.sendFile(path.join(APP_ROOT, "views", "mainview", "index.html"));
	});
	app.listen(process.env.FRONT_PORT ?? 5005, () => {
		console.log(`Server is running on port ${process.env.FRONT_PORT ?? 5005}`);
	});
	return `http://localhost:${process.env.FRONT_PORT ?? 5005}`//"views://mainview/index.html";
}


check_env(userData);

let system = getDataFromDatabase(APP_ROOT, "data", "system");
let profile: any = getDataFromDatabase(userData, "data", "profile");

setInterval(() => {
	writeDataToDatabase(userData, "data", "profile", profile)
}, 1000);
let player: Player = null as any;

if (system?.youtube_keys && system?.spotify_keys && system?.youtube_keys?.length !== 0 && system?.spotify_keys?.length !== 0) {
	player = new Player({
		youtube_api_keys: system.youtube_keys,
		spotify_api_keys: system.spotify_keys,
		path: userData,
		appPath: APP_ROOT,
		download_folder: profile.folder.length > 0 ? profile.folder : resolve(APP_ROOT, "downloads")
	});
	player.local.getfolder(profile.folder)
}


if (Discord_CLient_ID) {
	rpc = new Client({ clientId: Discord_CLient_ID });
	rpc.login().catch(() => { rpc = null }).then(() => {
		if (rpc) {
			rpc.on("ready", async () => {
				console.log("Discord RPC is ready");
				await rpc.user.setActivity({
					details: "Idle...",
					state: "Waiting for music...",
					startTimestamp: new Date(),
					largeImageText: "Kuumo app",
					instance: false
				})
			})
		}
	})
}

// Create the main application window
const url = await getMainViewUrl();
let isClosed = false;

const AppRPC = BrowserView.defineRPC({
	maxRequestTime: 60000,
	handlers: {
		requests: {
			api: async ({ url, mode, data }: { url: string, mode: "GET" | "SET", data: any }) => {
				try {
					// let { system, profile, player, win, ...received_data } = data;
					if (url !== "import") {
						let result: any = null;

						if ((!system.youtube_keys || system.youtube_keys.length === 0) && data.source === "youtube") {
							Utils.showMessageBox({
								type: "question",
								title: "message",
								message: `
										There is no Youtube Api Key in system.json!
										Try to get api key from google developer program.
										If you have data folder, please import it first.
									`,
								buttons: ["Import", "Go to google developer program"]
							}).then(({ response }) => {
								if (response === 0) {
									result = "Import"
								}
								else {
									result = "youtube"
								}
							})
						}
						else if ((!system.spotify_keys || system.spotify_keys.length === 0) && data.source === "spotify") {
							Utils.showMessageBox({
								message: `
										There is no Spotify Api Key in system.json!
										Try to get api key from spotify developer program.
										If you have data folder, please import it first.
									`,
								type: "question",
								buttons: ["Import", "Go to spotify developer program"]
							}).then(({ response }) => {
								if (response === 0) {
									result = "Import"
								}
								else {
									result = "spotify"
								}
							})
						}
						if (result === "Import") {
							return {
								ok: false,
								result
							}
						}
						else if (result !== null) {
							Utils.showMessageBox({
								message: `There is no method to get free system.json file. Please uninstall then install again. Exit program.`
							})
						}
					}

					if (mode === "GET") {
						let result: any = null;
						if (url === "music") {
							result = await MusicController(player, data)
						}
						else if (url === "home") {
							result = await HomeController(player, profile.pin);
						}
						else if (url === "profile") {
							result = await ProfileController(player, profile, { ...data, mode });
						}
						else if (url === "download") {
							result = await DownloadController(player);
						}
						else if (url === "downloadstatus") {
							result = player.status;
						}
						else if (url === "play") {
							result = await PlayController(player, data);
						}
						else if (url === "import") {
							await ImportControllers(userData);
							profile = getDataFromDatabase(userData, "data", "profile");
							// if (!check_system(userData)) {
							// 	// Error box
							// 	await Utils.showMessageBox({
							// 		type: "error",
							// 		title: "Error",
							// 		message: "Invalid system files",
							// 		buttons: ["OK"],
							// 		defaultId: 0,
							// 		cancelId: 0
							// 	});
							// }
							// system = getDataFromDatabase(userData, "data", "system");
							player = new Player({
								youtube_api_keys: system.youtube_keys,
								spotify_api_keys: system.spotify_keys,
								path: userData,
								appPath: APP_ROOT,
								download_folder: profile.folder.length > 0 ? profile.folder : resolve(APP_ROOT, "downloads")
							});
							player.local.getfolder(profile.folder)
							result = "ok";
						}
						else if (url === "ismax") {
							result = win.isMaximized();
						}
						else {
							throw new Error("Invalid url");
						}
						return {
							url, data: result, ok: true
						}
					}
					else {
						if (url === "profile") {
							await ProfileController(player, profile, { ...data, mode });
						}
						return {
							url, data: data, ok: true
						}
					}
				} catch (error) {
					console.error(error);
					throw new Error("Something went wrong");
				}
			},
			close: () => {
				if (isClosed) {
					win.close();
					Utils.quit();
				}
				else {
					win.minimize();
				}
			},
			minimize: () => { win.minimize() },
			maximize: () => { win.maximize(); isClosed = true; },
			checkForUpdate: async () => {
				const isUpdate = await Updater.checkForUpdate();
				return { ok: true, data: isUpdate };
			},
			downloadUpdate: async () => { await Updater.downloadUpdate(); return { ok: true } },
			update: async () => { await Updater.applyUpdate(); return { ok: true } },
			checkIfRPC: async () => {
				return { ok: true, data: rpc.user?.username ?? "Discord RPC is not connected" }
			},
			checkIfAutostart: () => {
				const result = Bun.argv.includes("--autostart");
				return { ok: true, data: result }
			},
			toggleAutostart: () => {
				const result = Bun.argv.includes("--autostart");
				if (result) {
					Bun.argv.splice(Bun.argv.indexOf("--autostart"), 1);
				}
				else {
					Bun.argv.push("--autostart");
				}
				return { ok: true, data: "ok" }
			},
			connect: async () => {
				rpc = new Client({ clientId: Discord_CLient_ID })
				rpc.login().catch(() => { rpc = null }).then(() => {
					if (rpc) {
						rpc.on("ready", async () => {
							console.log("Discord RPC is ready");
							await rpc.user.setActivity({
								details: "Idle...",
								state: "Waiting for music...",
								startTimestamp: new Date(),
								largeImageText: "Kuumo app",
								instance: false
							})
						})
					}
				})
			},
			setmusic: async ({ track }: { track: any }) => {
				if (rpc) {
					if (track.thumbnail.length > 300) {

						const { name } = track;
						const ytb_tracks = getDataFromDatabase(userData, "data", "youtube", "tracks");
						const spt_tracks = getDataFromDatabase(userData, "data", "spotify", "tracks");

						let result: any = null;

						const isYoutube = Object.keys(ytb_tracks).find((key: string) => {
							return ytb_tracks[key].name === name;
						})
						if (isYoutube) {
							result = ytb_tracks[isYoutube];
						}
						else {
							const isSpotify = Object.keys(spt_tracks).find((key: string) => {
								return spt_tracks[key].name === name;
							})
							if (isSpotify) {
								result = spt_tracks[isSpotify];
							}
							else {
								const ytb_search = await player.youtube.search(name, "video");
								const spt_search = await player.spotify.search(name);

								if (ytb_search.tracks.length > 0) {
									result = ytb_search.tracks[0];
								}
								else if (spt_search.tracks.length > 0) {
									result = spt_search.tracks[0];
								}
								else {
									result = null;
								}
							}
						}

						track.thumbnail = result ? result.thumbnail : "default";
					}
					const activity: SetActivity = {
						type: ActivityType.Listening,
						details: track.name,
						state: track.artist,
						smallImageKey: track.thumbnail,
						smallImageText: track.name,
						instance: false,
					}
					if (track.isPlaying) {
						activity.startTimestamp = track.start;
						activity.endTimestamp = track.end;
					}
					await rpc.user.setActivity(activity)
				}
				return { ok: true }
			},
			clearmusic: async () => {
				if (rpc) {
					await rpc.user.setActivity({
						details: "Idle...",
						state: "Waiting for music...",
						startTimestamp: new Date(),
						largeImageText: "Kuumo app",
						instance: false
					})
				}
				return { ok: true }
			},
			setfolder: async () => {
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

					return { ok: true, data: value[0] };
				} catch (error) {
					return { ok: false, data: error };
				}
			},
			test: ({ a, b }: { a: number, b: number }) => { return a + b; }
		}
	}
})

win = new BrowserWindow({
	title: "Music app",
	url, rpc: AppRPC
});

// Define the base menu structure
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

tray = new Tray({
	title: "music app",
	image: resolve(APP_ROOT, "assets", "trayicon.ico"),
	template: true
});

tray.setMenu(getTrayMenu(true));

tray.on("tray-clicked", (e: any) => {
	const action = e.data.action;

	switch (action) {
		case "show":
			win?.show();
			win?.focus();
			win?.maximize();
			tray.setMenu(getTrayMenu(true));
			break;

		case "hide":
			win?.minimize();
			tray.setMenu(getTrayMenu(false));
			break;

		case "quit":
			Utils.quit();
			break;
	}
});

win.on("dom-ready", () => {
	win.maximize();
	win.webview.openDevTools();
});

console.log("React Tailwind Vite app started!");
win.webview.rpcHandler("test");
