import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path"
import { getDataFromDatabase } from "./lib/database";

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

export function check_system(executableDir: string) {
    if (!existsSync(resolve(executableDir, "data", "system.json"))) {
        return false;
    }

    const system = getDataFromDatabase(executableDir, "data", "system");
    if (!system) return false;
    if (!system.youtube_keys && !system.spotify_keys) return false;
    if (system.youtube_keys.length === 0 && system.spotify_keys.length === 0) return false;
    return true;
}