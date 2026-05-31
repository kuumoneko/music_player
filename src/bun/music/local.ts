import { join } from "node:path";
import { Track } from "@/shared/types.ts";
import { getAllLocalFiles, writeLogs } from "../db/index.ts";
import { writeLocalFiles } from "../db/index.ts";
import { readdir } from "node:fs/promises";
import FFmpeg from "../ffmpeg/index.ts";

export class Local {
    public folder: string = "";
    public appPath: string = "";
    private ffmpeg: FFmpeg;

    constructor(path: string, appPath: string) {
        this.folder = path;
        this.appPath = appPath;
        this.ffmpeg = new FFmpeg(appPath);
    }

    async getThumbnail(file: string): Promise<string> {
        try {
            const result = this.ffmpeg.readThumbnail(file);
            return result ?? "";
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            writeLogs([{ type: "error", message: `FFmpeg thumbnail extraction failed: ${message}` }]);
            return "";
        }
    }

    async getFileModifiedAt(file: string): Promise<number> {
        try {
            const stat = await Bun.file(file).stat();
            return stat.mtimeMs;
        } catch {
            return 0;
        }
    }

    async parseFile(file: string): Promise<Track> {
        try {
            const metadata = this.ffmpeg.readMetadata(file);
            const tags = metadata.tags ?? {};
            return {
                source: "local",
                name: tags["title"] ?? "",
                id: file,
                duration: metadata.duration ? Math.floor(metadata.duration) * 1000 : 0,
                releasedDate: tags["date"] ?? "",
                artist: [
                    {
                        id: "", name: tags["artist"] ?? "Unknown Artist"
                    }
                ],
                thumbnail: await this.getThumbnail(file),
                fileModifiedAt: await this.getFileModifiedAt(file),
            };
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            writeLogs([{ type: "error", message: `Failed to parse file ${file}: ${message}` }]);
            throw e;
        }
    }

    async getfolder(folder: string) {
        if (folder.length === 0) return [];
        const local_files = getAllLocalFiles();
        const localFilesMap = new Map(local_files.map((item: Track) => [item.id, item]));

        const dirents = await readdir(folder, { withFileTypes: true });

        const processingPromises = [];

        for (let i = 0; i < dirents.length; i++) {
            const dirent = dirents[i];

            if (dirent.isFile()) {
                const name = dirent.name.toLowerCase();

                if (
                    name.endsWith(".mp3") ||
                    name.endsWith(".m4a") ||
                    name.endsWith(".flac") ||
                    name.endsWith(".wav") ||
                    name.endsWith(".ogg") ||
                    name.endsWith(".aac")
                ) {
                    const filePath = join(folder, dirent.name);
                    const cached = localFilesMap.get(filePath);

                    const task = (async () => {
                        if (cached?.thumbnail && cached.thumbnail.length > 0) {
                            const currentMtime = await this.getFileModifiedAt(filePath);
                            if (currentMtime === cached.fileModifiedAt) {
                                return cached;
                            }
                        }
                        return this.parseFile(filePath);
                    })().catch((e) => {
                        const message = e instanceof Error ? e.message : String(e);
                        writeLogs([{ type: "error", message }]);
                        return null;
                    });

                    processingPromises.push(task);
                }
            }
        }
        const rawResults = await Promise.all(processingPromises);

        const result: Track[] = rawResults.filter((item) => item !== null);
        writeLocalFiles(result);

        return result;
    }
}
