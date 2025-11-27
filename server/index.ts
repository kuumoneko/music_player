import express from "express";
import cors from "cors";
import { config } from "dotenv";
import { dirname, join, resolve } from "node:path";
import { getDataFromDatabase } from "./lib/database.ts";
import { exit } from "node:process";
import Player from "./music/index.ts";
import ProfileRoute from "./routes/profileRoute.ts";
import DownloadRoute from "./routes/downloadRoute.ts";
import MusicRoute from "./routes/musicRoute.ts";
import playRoute from "./routes/playRoute.ts";
import homeRoute from "./routes/homeRoute.ts";
import searchRoute from "./routes/searchRoute.ts";
import { existsSync } from "node:fs";
import check_env from "./env.ts";
import open from "open";

enum Mode {
    react = "react",
    app = "test",
    deploy = "deploy"
}

config()
const PORT = process?.env?.PORT ?? 3000;
const mode = process?.env?.MODE === "test" ? Mode.app : process?.env?.MODE === "react" ? Mode.react : Mode.deploy;
console.log(mode)
if (mode === Mode.react && !process?.env["SERVERPATH"]) {
    console.log("SERVERPATH is not set");
    exit(1)
}

const app = express();
app.use(cors({
    origin: mode === Mode.react ? "http://localhost:3001" : "http://localhost:3000"
}));
app.use(express.json());


const executablePath = process.execPath;
let isIdle = {
    idle: false,
    time: 0
};

setInterval(() => {
    isIdle = {
        idle: true,
        time: isIdle.time + 1000,
    };
    if (isIdle.idle && isIdle.time > 10 * 60 * 1000) {
        console.log("No request for 10 minutes, close app");
        exit(0);
    }
}, 1000);


let executableDir: string = ""
switch (mode as Mode) {
    case Mode.deploy:
        executableDir = dirname(executablePath);
        break;
    default:
        executableDir = resolve(process.env["SERVERPATH"] as string, "server");
}

if (!existsSync(resolve(executableDir, "data", "system.json"))) {
    console.error("System.json is not existed! Exit program. Please contact to administrator to get system.json file.");
    exit(1);
}
check_env(executableDir)


const system = getDataFromDatabase(executableDir, "data", "system");
let profile: any = getDataFromDatabase(executableDir, "data", "profile");
const binary = resolve(executableDir, "bin");

if (mode as Mode === Mode.deploy || mode as Mode === Mode.app) {
    const folderPath = (mode as Mode === Mode.deploy) ? join(executableDir, "dist") : join(executableDir, "..", "dist")
    app.use(express.static(folderPath));
    app.get('/', (_req, res) => {
        res.sendFile(join(folderPath, 'index.html'));
    });
}

let player: Player = null as any;

app.use("/", (req: any, _res: any, next: any) => {
    isIdle = {
        idle: false,
        time: 0
    };
    if (req.url.includes("download") && !req.url.includes("profile")) {
        req.download = profile.download;
    }
    if (req.url.includes("profile") || req.url.includes("home")) {
        profile = getDataFromDatabase(executableDir, "data", "profile");
        req.profile = profile;
    }

    req.player = player;
    next();
});

player = new Player({
    youtube_api_keys: system.youtube_keys,
    spotify_api_keys: system.spotify_keys,
    path: executableDir,
    download_folder: profile.folder.length > 0 ? profile.folder : resolve(executableDir, "downloads"),
    bin: binary
})

app.listen(PORT, () => {
    console.log(`Server run on ${PORT}`);
    console.log(`CORS on ${Mode.react ? "http://localhost:3001" : "http://localhost:3000"}`)
})

player.local.getfolder(profile.folder)

if (mode === Mode.deploy) {
    open(`http://localhost:${PORT}`);
}

app.use("/profile", ProfileRoute);
app.use("/download", DownloadRoute);
app.use("/music", MusicRoute);
app.use("/play", playRoute);
app.use("/home", homeRoute);
app.use("/search", searchRoute);