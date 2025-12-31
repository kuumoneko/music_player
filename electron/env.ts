import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path"
import seven from "7zip-min"

const all_paths = [
    { path: '/data/local/local.json', default: '{}' },
    { path: '/data/profile.json', default: '{"play":[],"local":[],"folder":"","pin":[],"download":[]}' },
    { path: '/data/spotify/tracks.json', default: '{}' },
    { path: '/data/spotify/playlists.json', default: '{}' },
    { path: '/data/youtube/playlists.json', default: '{}' },
    { path: '/data/youtube/tracks.json', default: '{}' },
    { path: '/data/youtube/artists.json', default: '{}' }
]

export default function check_env(executableDir: string) {
    all_paths.forEach((item: { path: string, default: string }) => {
        const filePath = resolve(executableDir, ...item.path.split("/").slice(1));
        const folderPath = dirname(filePath);
        if (!existsSync(filePath)) {
            mkdirSync(folderPath, { recursive: true });
            writeFileSync(filePath, item.default, { encoding: "utf-8" });
            console.log(`Created: ${filePath}`);
        }
        else {
            console.log(`${filePath} already exists`)
        }
    });
}

export async function check_ffmpeg(executableDir: string) {
    if (!existsSync(resolve(executableDir, "bin", "ffmpeg.exe")) || !existsSync(resolve(executableDir, "bin", "ffprobe.exe"))) {
        let fileName: string = "";
        if (!existsSync(resolve(executableDir, "ffmpeg-git-essentials.7z"))) {
            const download_url = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-git-essentials.7z";
            console.log("Downloading FFMPEG...");
            const response = await fetch(download_url);
            const res = await fetch(response.url);
            fileName = response.url.split("https://www.gyan.dev/ffmpeg/builds/packages/")[1].split(".7z")[0];

            const arrayBuffer = await res.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            writeFileSync(resolve(executableDir, "ffmpeg-git-essentials.7z"), buffer);
            console.log("downloaded FFMPEG.")
        }
        seven.config({
            binaryPath: resolve(executableDir, "node_modules", "7zip-bin", "win", "x64", "7za.exe")
        })
        seven.unpack(resolve(executableDir, "ffmpeg-git-essentials.7z"), resolve(executableDir, "ffmpeg"), (err) => {
            if (err) {
                console.error("Error extracting files:", err);
            } else {
                console.log("Files extracted successfully.");
                mkdirSync(resolve(executableDir, "bin"), { recursive: true });
                const binDir = resolve(executableDir, "ffmpeg", fileName, "bin");
                writeFileSync(resolve(executableDir, "bin", "ffmpeg.exe"), readFileSync(resolve(binDir, "ffmpeg.exe")));
                writeFileSync(resolve(executableDir, "bin", "ffprobe.exe"), readFileSync(resolve(binDir, "ffprobe.exe")));

                rmSync(resolve(executableDir, "ffmpeg"), { recursive: true });
                rmSync(resolve(executableDir, "ffmpeg-git-essentials.7z"));
            }
        })
    }
    else {
        console.log("ffmpeg and ffprobe found.")
    }
}