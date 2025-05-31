// system
import path from 'node:path';
import { mkdir } from 'node:fs/promises';

// project types
import Downloader from "./include/src/index.ts";
import { Audio_format, download_mode } from "./include/src/type.ts";

// third party
import yargs from "yargs";
import { hideBin } from 'yargs/helpers';

// env
import env from "./include/BE/env.json" with { type: "json" };

// get the path of this file
const executablePath = process.execPath;
const executableDir = path.dirname(executablePath);

// create the yargs for command
const argv = yargs(hideBin(process.argv)) // Call yargs() here and pass processed args
    // download folder

    .option('folder', {
        alias: 'f',
        description: 'Download folder\nPlease open File explore, create the folder, then copy as path as path\\\\to\\\\folder',
        type: 'string',
        demandOption: false
    })
    // extension of music file, support mp3 , m4a
    .option('format', {
        alias: 'fm',
        description: "The format of the music file\nNow support mp3 and m4a",
        type: 'string'
    })
    // check for update
    .option('check-for-update', {
        alias: 'cfu',
        description: "Check for update",
        type: 'boolean'
    })
    .help() // Add help option
    .version("1.0.0")
    .alias('help', 'h')
    .alias('version', 'v')
    .parseSync(); // Use parseSync() or parse() instead of .argv for better type inference and execution

let folderPath = "";
if (argv.folder && typeof argv.folder === "string") {
    folderPath = argv.folder;
} else if ((argv.folder && typeof argv.folder === "object")) {
    folderPath = argv.folder[0] as string;
}
else {
    folderPath = "No folder found"
}

const folder = folderPath;
const links = argv._.map(String);
const ext = argv.format ? argv.format : Audio_format.m4a;

const ffmpeg = `${executableDir}\\include\\support\\ffmpeg\\ffmpeg.exe`,
    ytdlp = `${executableDir}\\include\\support\\yt-dlp.exe`,
    spotdlp = `${executableDir}\\include\\support\\spot-dlp.exe`,
    spot_errors = `${executableDir}\\include\\BE\\spot.txt`;

console.log("Your download folder is ", folder);

const downloader = new Downloader({
    ytdlp: ytdlp,
    spotdlp: spotdlp,
    ffmpeg: ffmpeg,
    download_folder: folder,
    curr_folder: executableDir,
    spot_errors: spot_errors,
    audio_format: ext as Audio_format,
    youtube_api_key: env.Youtube_Api_key,
    spotify_api_key: env.Spotify_Api_key,
    spotify_client: env.Spotify_client
});

async function run() {
    await mkdir(`${folder}`, { recursive: true });

    if (links.length == 0) {
        console.error("No links found");
        return;
    }
    if (folder as string == "No folder found") {
        console.error("No folder found, please use --folder or -f to specify the folder");
        return;
    }

    await downloader.check_env();

    await downloader.add_to_queue({
        mode: download_mode.audio,
        link: links
    })

    await downloader.checking();

    await downloader.download();
}

run();