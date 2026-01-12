import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, Tray } from 'electron'
import { autoUpdater } from 'electron-updater';
import { config } from "dotenv";

import path from 'node:path'
import { resolve } from "node:path";
import { exit } from "node:process";
import { existsSync } from "node:fs";

import DiscordRPC, { Client, SetActivity } from "@xhayper/discord-rpc"
import { ActivityType } from "discord-api-types/v10";

import Player from "./music/index.ts";
import { getDataFromDatabase } from "./lib/database.ts";
import check_env, { check_system } from "./env.ts";
import MusicController from './controllers/music.ts';
import HomeController from './controllers/home.ts';
import ProfileController from './controllers/profile.ts';
import DownloadController from './controllers/download.ts';
import PlayController from './controllers/play.ts';
import ImportControllers from './controllers/import.ts';
import open from 'open';

config();

process.env.APP_ROOT = path.join(__dirname, '..');

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
export const CLIENT_ID = process.env.CLIENT_ID;
export const user_data = app.getPath("userData");

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST;

let win: BrowserWindow | null;
let tray: Tray | null;
let rpc: DiscordRPC.Client;
let isMaximized = true;
let isClosed = false;

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        if (win) {
            if (win.isMinimized()) win.restore();
            if (!win.isVisible()) win.show();
            win.focus();
        }
    });
}

check_env(user_data);

if (!existsSync(resolve(process.env.APP_ROOT, "data", "system.json"))) {
    dialog.showErrorBox("Can't find system.json", "Please find system.json in your computer and copy to app folder or contact administrator to get system.json file");
    exit(0);
}


let system = getDataFromDatabase(process.env.APP_ROOT, "data", "system");
let profile: any = getDataFromDatabase(user_data, "data", "profile");
let player: Player = null as any;
if (system?.youtube_keys && system?.spotify_keys && system?.youtube_keys?.length !== 0 && system?.spotify_keys?.length !== 0) {
    player = new Player({
        youtube_api_keys: system.youtube_keys,
        spotify_api_keys: system.spotify_keys,
        path: user_data,
        download_folder: profile.folder.length > 0 ? profile.folder : resolve(process.env.APP_ROOT, "downloads")
    });
    player.local.getfolder(profile.folder)
}




if (CLIENT_ID) {
    rpc = new Client({ clientId: CLIENT_ID })
    rpc.login().catch(console.error);

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

async function createWindow() {
    win = new BrowserWindow({
        icon: path.join(process.env.VITE_PUBLIC, 'favicon.ico'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            backgroundThrottling: false,
        },
        frame: false,
    })
    win.maximize();
    win.removeMenu();

    win.webContents.on('did-finish-load', () => {
        win?.webContents.send('main-process-message', (new Date).toLocaleString())
    })

    if (VITE_DEV_SERVER_URL) {
        win.loadURL(VITE_DEV_SERVER_URL)
    } else {
        win.loadFile(path.join(RENDERER_DIST, 'index.html'))
    }

    if (app.isPackaged) {
        autoUpdater.checkForUpdatesAndNotify();
    }
}

function createTray() {
    const iconPath = path.join(process.env.VITE_PUBLIC, "trayicon.ico");
    const icon = nativeImage.createFromPath(iconPath);
    tray = new Tray(icon);
    tray.setToolTip("Kuumo");
    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Show App',
            click: () => {
                win?.show();
                isClosed = false;
            }
        },
        {
            label: 'Quit',
            click: () => {
                win.close();
                exit(0);
            }
        }
    ]);

    tray.setContextMenu(contextMenu);

    tray.on('click', () => {
        if (win?.isVisible()) {
            win.hide();
            isClosed = true;
        } else {
            win?.show();
            isClosed = false;
        }
    });
}

autoUpdater.on("update-available", () => {
    console.log("Update available");
})

autoUpdater.on("update-downloaded", () => {
    console.log("Update downloaded");
    autoUpdater.quitAndInstall();
})

autoUpdater.on("error", () => {
    console.error("Something went wrong while updating")
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
        win = null;
        exit(0);
    }
})

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
})

ipcMain.handle("close", () => {
    if (!isClosed) {
        win.hide();
        isClosed = true;
    }
    else {
        win.close();
        exit(0);
    }
})

ipcMain.handle("minimize", () => {
    win.minimize();
})

ipcMain.handle("api", async (_event: any, arg: any) => {
    try {
        const { mode, data } = arg;
        const { url, data: received_data } = data;

        if (url !== "import") {
            let result: any = null;

            if ((!system.youtube_keys || system.youtube_keys.length === 0) && received_data.source === "youtube") {
                dialog.showMessageBox(win, {
                    title: "message",
                    message: `
                        There is no Youtube Api Key in system.json!
                        Try to get api key from google developer program.
                        If you have data folder, please import it first.
                    `,
                    type: "question",
                    buttons: ["Import", "Go to google developer program"],
                    textWidth: 500
                }).then(({ response }) => {
                    if (response === 0) {
                        result = "Import"
                    }
                    else {
                        result = "youtube"
                    }
                })
            }
            else if ((!system.spotify_keys || system.spotify_keys.length === 0) && received_data.source === "spotify") {
                dialog.showMessageBox(win, {
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
                dialog.showMessageBox(win, {
                    message: `There is no method to get free system.json file. Try to do the step on github page to get api key and system file. Exit program.`
                })
                open("https://github.com/kuumoneko/music_player#README").then(() => { exit(0) })
            }
        }

        if (mode === "GET") {
            let result: any = null;
            if (url === "music") {
                result = await MusicController(player, received_data)
            }
            else if (url === "home") {
                result = await HomeController(player, profile.pin);
            }
            else if (url === "profile") {
                result = await ProfileController(player, profile, { ...received_data, mode });
            }
            else if (url === "download") {
                result = await DownloadController(player);
            }
            else if (url === "downloadstatus") {
                result = player.status;
            }
            else if (url === "play") {
                result = await PlayController(player, received_data);
            }
            else if (url === "import") {
                await ImportControllers(user_data);
                profile = getDataFromDatabase(user_data, "data", "profile");
                if (!check_system(user_data)) {
                    dialog.showErrorBox("Error", "Invalid system files")
                }
                system = getDataFromDatabase(user_data, "data", "system");
                player = new Player({
                    youtube_api_keys: system.youtube_keys,
                    spotify_api_keys: system.spotify_keys,
                    path: user_data,
                    download_folder: profile.folder.length > 0 ? profile.folder : resolve(process.env.APP_ROOT, "downloads")
                });
                player.local.getfolder(profile.folder)
                result = "ok";
            }
            else if (url === "ismax") {
                result = isMaximized;
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
                await ProfileController(player, profile, { ...received_data, mode });
            }
            return {
                url, data: received_data, ok: true
            }
        }
    }
    catch (e: any) {
        console.error(e);
        throw e;
    }
})

ipcMain.handle("discord", async (_event: any, arg: any) => {
    try {
        const { url, data }: { url: string, data: any } = arg;

        if (url === "setmusic") {

            if (rpc) {
                if (data.thumbnail.length > 300) {

                    const { name } = data;
                    const ytb_tracks = getDataFromDatabase(user_data, "data", "youtube", "tracks");
                    const spt_tracks = getDataFromDatabase(user_data, "data", "spotify", "tracks");

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

                    data.thumbnail = result ? result.thumbnail : "default";
                }
                const activity: SetActivity = {
                    type: ActivityType.Listening,
                    details: data.name,
                    state: data.artist,
                    smallImageKey: data.thumbnail,
                    smallImageText: data.name,
                    instance: false,
                }
                if (data.isPlaying) {
                    activity.startTimestamp = data.start;
                    activity.endTimestamp = data.end;
                }
                await rpc.user.setActivity(activity)
            }
            return { ok: true }
        }
        else if (url === "clearmusic") {
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
        }
        else {
            throw new Error("Invalid url")
        }
    }
    catch (e) {
        console.log(e);
        throw e;
    }
})

app.whenReady().then(() => {
    createWindow();
    createTray();
})
