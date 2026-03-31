import { resolve } from 'node:path';
import { rm, readdir, unlink, mkdir, exists } from 'node:fs/promises';

export async function checkUserDataFolder(userDataFolder: string) {
    const all_paths = [
        { path: "log.json", default: "[]" },
        { path: 'local.json', default: '[]' },
        { path: 'profile.json', default: '{"play":[],"local":[],"folder":"","pin":[],"download":[]}' },
        { path: 'tracks.json', default: '{}' },
        { path: 'playlists.json', default: '{}' },
        { path: 'artists.json', default: '{}' },
        { path: 'user.json', default: '{"repeat":0,"shuffle":0,"volume":50,"height":600,"width":800,"currentPlaying":{"source":"","id":"","title":"","thumbnail":"","artist":""},"isMaximized":false,"queue":[],"nextfrom":{"from":"","next":[]},"QuitonClose":false,"playedTrack":[],"isLoading":false,"current":{"time":0,"duration":0},"isPlaying":false}' }
    ]

    async function getAllFilesInDirectory(dir: string, fileArray: string[] = []) {
        if (!await exists(dir)) return fileArray;

        const items = await readdir(dir, { withFileTypes: true, recursive: true });

        for (const item of items) {
            const fullPath = resolve(dir, item.name);
            if (item.isDirectory()) {
                const temp = await getAllFilesInDirectory(fullPath, fileArray);
                fileArray = [...new Set(fileArray), ...temp];
            } else {
                fileArray.push(fullPath);
            }
        }
        return fileArray;
    }

    const dataDir = resolve(userDataFolder, "data");
    if (!await exists(dataDir)) {
        await mkdir(dataDir, { recursive: true });
    }
    const expectedFiles = all_paths.map(p => ({
        path: resolve(dataDir, p.path),
        default: p.default
    }));
    const files = await getAllFilesInDirectory(dataDir);


    for (const file of expectedFiles) {

        if (!files.includes(file.path)) {
            await Bun.write(Bun.file(file.path), file.default);
        }
    }

    for (const file of files) {
        if (!expectedFiles.map(p => p.path).includes(file)) {
            await unlink(file);
        }
    }

    //remove all folder
    const items = await readdir(dataDir, { withFileTypes: true });
    for (const item of items) {
        if (item.isDirectory()) {
            const fullPath = resolve(dataDir, item.name);
            try {
                await rm(fullPath, { recursive: true });
            } catch (e) {
                console.error(`Could not remove directory: ${fullPath}`);
            }
        }
    }

    for (const item of expectedFiles) {
        const data = await Bun.file(item.path).text();
        if (!data || data.length < item.default.length) {
            await Bun.write(Bun.file(item.path), item.default)
        }
    }
}