import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path"

const all_paths = [
    { path: "/log.json", default: "[]" },
    { path: '/local.json', default: '{}' },
    { path: '/profile.json', default: '{"play":[],"local":[],"folder":"","pin":[],"download":[]}' },
    { path: '/tracks.json', default: '{}' },
    { path: '/playlists.json', default: '{}' },
    { path: '/artists.json', default: '{}' },
    { path: '/user.json', default: '{"repeat":0,"shuffle":0,"volume":50,"height":600,"width":800,"currentPlaying":{"source":"","id":"","title":"","thumbnail":"","artist":""},"isMaximized":false,"queue":[],"nextfrom":{"from":"","next":[]},"QuitonClose":false,"playedTrack":[],"isLoading":false,"current":{"time":0,"duration":0},"isPlaying":false}' }
]


/**
 * check if the data folder and files exist, if not create them, if file exists, do nothing, if there are other files in the data folder, remove them
 */
export default function check_user_data(executableDir: string) {
    function getAllFilesInDirectory(dir: string, fileArray: string[] = []) {
        if (!existsSync(dir)) return fileArray;

        const items = readdirSync(dir, { withFileTypes: true, recursive: true });

        for (const item of items) {
            const fullPath = resolve(dir, item.name);
            if (item.isDirectory()) {
                const temp = getAllFilesInDirectory(fullPath, fileArray);
                fileArray = [...new Set(fileArray), ...temp];
            } else {
                fileArray.push(fullPath);
            }
        }
        return fileArray;
    }

    const dataDir = resolve(executableDir, "data");
    if (!existsSync(dataDir)) {
        mkdirSync(dataDir, { recursive: true });
    }
    const expectedFiles = all_paths.map(p => ({
        path: join(dataDir, p.path),
        default: p.default
    }));
    const files = getAllFilesInDirectory(dataDir);


    for (const file of expectedFiles) {

        if (!files.includes(file.path)) {
            writeFileSync(file.path, file.default, { encoding: "utf-8" });
        }
    }

    for (const file of files) {
        if (!expectedFiles.map(p => p.path).includes(file)) {
            unlinkSync(file);
        }
    }

    //remove all folder
    const items = readdirSync(dataDir, { withFileTypes: true });
    for (const item of items) {
        if (item.isDirectory()) {
            const fullPath = resolve(dataDir, item.name);
            try {
                rmSync(fullPath, { recursive: true });
            } catch (e) {
                console.error(`Could not remove directory: ${fullPath}`);
            }
        }
    }

    for (const item of expectedFiles) {
        const data = readFileSync(item.path);
        if (!data || data.length < item.default.length) {
            writeFileSync(item.path, item.default);
        }
    }
}