// ts-nocheck

// server
import path from 'node:path';

// downloader
import Downloader from './downloader/index.ts';
import { Audio_format, Mode } from "./downloader/music/types.ts";

// yargs for exe file
import yargs from "yargs";
import { hideBin } from 'yargs/helpers';
import { Server_mode } from "./types.ts";
import { getDataFromDatabase } from "./dist/function.ts";
import { server } from "./react.ts";
import run from "./server.ts";

const argv = yargs(hideBin(process.argv)) // Call yargs() here and pass processed args
    .option('test', {
        alias: 't',
        description: 'development server',
        type: 'boolean',
    })
    .option('folder', {
        alias: 'f',
        description: 'Download folder\nPlease open File explore, create the folder, then copy as path as path\\\\to\\\\folder',
        type: 'string',
    })
    // extension of music file, support mp3 , m4a
    .option('format', {
        alias: 'fm',
        description: "The format of the music file\nNow support mp3 and m4a",
        type: 'string'
    })
    // check for update, will update later
    .option('check-for-update', {
        alias: 'cfu',
        description: "Check for update",
        type: 'boolean'
    })
    .option('nocheck', {
        description: "Checking to delete the track that dont have in links",
        type: "boolean"
    })
    .help() // Add help option
    .version("1.0.0")
    .alias('help', 'h')
    .alias('version', 'v')
    .parse(); // Use parseSync() or parse() instead of .argv for better type inference and execution

console.log(argv)
let run_app: boolean = true;
let folderPath = "";
let folder: string, links: string[], ext: string = Audio_format.m4a, checking: boolean;

if (argv.folder || argv.format || argv.nocheck) {
    run_app = false;
    if (argv.folder && typeof argv.folder === "string") {
        folderPath = argv.folder;
    } else if ((argv.folder && typeof argv.folder === "object")) {
        folderPath = argv.folder[0] as string;
    }
    else {
        folderPath = "No folder found"
    }
    folder = folderPath;
    links = argv._.map(String);
    ext = argv.format ? argv.format : Audio_format.m4a;
    checking = argv.nocheck ? false : true;
}

const mode = Server_mode.server;

const executablePath = process.execPath;

const executableDir = (mode as string === Server_mode.server) ? path.dirname(executablePath) : "E:\\MDS_app\\server"; // Fallback for development mode

console.log(`Application root directory set to: ${executableDir}\\support`);

const system = getDataFromDatabase(executableDir, "data", "system");

const downloader = new Downloader({
    ytdlp: path.join(executableDir, 'support', 'yt-dlp.exe'),
    spotdlp: path.join(executableDir, 'support', 'spot-dlp.exe'),
    ffmpeg: path.join(executableDir, 'support', 'ffmpeg', 'ffmpeg.exe'),
    download_folder: (run_app === false) ? folderPath : path.join(executableDir, 'download'),
    curr_folder: path.join(executableDir),
    spot_errors: path.join(executableDir, 'BE', 'spot.txt'),
    audio_format: ext as unknown as Audio_format,
    youtube_api_key: system.Youtube_Api_key,
    google_client_id: system.web.client_id,
    google_client_secret: system.web.client_secret,
    redirect_uris: system.web.redirect_uris,
    spotify_api_key: system.Spotify_Api_key,
    spotify_client: system.Spotify_client

}, (mode as string === Server_mode.server) ? Mode.deploy : Mode.test);

async function run_MDS() {
    await downloader.check_env();

    if (run_app) {
        await server(executableDir, downloader, mode);
    }
    else {
        await run(downloader, folder, links, checking);
    }
}
run_MDS();