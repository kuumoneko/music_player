import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import path from 'node:path'
import { config } from "dotenv";
import { resolve } from "node:path";
import { getDataFromDatabase } from "./lib/database.ts";
import { exit } from "node:process";
import Player from "./music/index.ts";
import { existsSync } from "node:fs";
import check_env, { check_ffmpeg } from "./env.ts";
import MusicController from './controllers/music.ts';
import HomeController from './controllers/home.ts';
import ProfileController from './controllers/profile.ts';
import DownloadController from './controllers/download.ts';
import PlayController from './controllers/play.ts';
import ImportControllers from './controllers/import.ts';

config();

process.env.APP_ROOT = path.join(__dirname, '..');

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST;
if (!existsSync(resolve(process.env.APP_ROOT, "data", "system.json"))) {
    dialog.showErrorBox("Error", "System.json is not existed! Exit program. Please contact to administrator to get system.json file.");
    exit(1);
}

check_env(process.env.APP_ROOT)


const system = getDataFromDatabase(process.env.APP_ROOT, "data", "system");
if (!system.youtube_keys || !system.spotify_keys || system.youtube_keys.length === 0 || system.spotify_keys.length === 0) {
    dialog.showErrorBox("Error", "There is no api key in system.json! Exit program. Please contact to administrator to get api key.");
    exit(1);
}
let profile: any = getDataFromDatabase(process.env.APP_ROOT, "data", "profile");
const binary = resolve(process.env.APP_ROOT, "bin");
let player: Player = null as any;
player = new Player({
    youtube_api_keys: system.youtube_keys,
    spotify_api_keys: system.spotify_keys,
    path: process.env.APP_ROOT,
    download_folder: profile.folder.length > 0 ? profile.folder : resolve(process.env.APP_ROOT, "downloads"),
    bin: binary
});
player.local.getfolder(profile.folder)

let win: BrowserWindow | null

async function createWindow() {
    await check_ffmpeg(process.env.APP_ROOT);
    win = new BrowserWindow({
        icon: path.join(process.env.VITE_PUBLIC, 'favicon.ico'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
        }
    })
    win.maximize();

    win.webContents.on('did-finish-load', () => {
        win?.webContents.send('main-process-message', (new Date).toLocaleString())
    })

    if (VITE_DEV_SERVER_URL) {
        win.loadURL(VITE_DEV_SERVER_URL)
    } else {
        win.loadFile(path.join(RENDERER_DIST, 'index.html'))
    }
}

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
        win = null;
        exit(0);
    }
})

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
    }
})

ipcMain.handle("api", async (_event: any, arg: any) => {
    try {
        const { mode, data } = arg;
        const { url, data: received_data } = data;
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
                await ImportControllers(process.env.APP_ROOT);
                profile = getDataFromDatabase(process.env.APP_ROOT, "data", "profile");
                result = "ok"
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

app.whenReady().then(createWindow)
