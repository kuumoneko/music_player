import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path"

const all_paths = [
    { path: '/data/local/local.json', default: '{}' },
    { path: '/data/system.json', default: '{}' },
    { path: '/data/profile.json', default: '{}' },
    { path: '/data/spotify/tracks.json', default: '{}' },
    { path: '/data/spotify/playlists.json', default: '{}' },
    { path: '/data/youtube/playlists.json', default: '{}' },
    { path: '/data/youtube/tracks.json', default: '{}' },
    { path: '/data/youtube/artists.json', default: '{}' }
]

export default function check_env(executableDir: string) {
    all_paths.forEach((path: { path: string, default: string }) => {
        const file = resolve(executableDir, ...path.path.split("/"));
        if (!existsSync(file)) {
            mkdirSync(file, { recursive: true });
            writeFileSync(file, path.default, { encoding: "utf-8" });
        }
        else {
            console.log(`${file} already exists`)
        }
    })
}