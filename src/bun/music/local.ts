import { join } from "node:path";
import { Track } from "@/shared/types.ts";
import { getAllLocalFiles, writeLogs } from "../db/index.ts";
import { writeLocalFiles } from "../db/index.ts";
import { readdir } from "node:fs/promises";

export class Local {
    public folder: string = "";
    public appPath: string = "";

    constructor(path: string, appPath: string) {
        this.folder = path;
        this.appPath = appPath;
    }

    async getThumbnail(file: string): Promise<string> {
        console.log(file)
        try {
            const ffmpeg = Bun.spawn([
                `${this.appPath}/ffmpeg.exe`,
                '-i', file,
                '-map', '0:v:0',
                '-vframes', '1',
                '-c:v', 'mjpeg',
                '-f', 'image2pipe',
                '-'
            ], {
                stdout: "pipe",
                stderr: "ignore",
            });

            const buffer = await Bun.readableStreamToArrayBuffer(ffmpeg.stdout);
            const exitCode = await ffmpeg.exited;
            if (exitCode === 0 && buffer.byteLength > 0) {
                const base64Image = Buffer.from(buffer).toString('base64');
                return `data:image/jpeg;base64,${base64Image}`;
            }

            return "";
        } catch (error) {
            console.error("FFmpeg extraction failed:", error);
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
        // console.log(file)
        try {
            const ffprobe = Bun.spawn([
                `${this.appPath}/ffprobe.exe`,
                '-v', 'quiet',
                '-print_format', 'json',
                '-show_format',
                '-show_streams',
                file,
            ]);

            const output = await new Response(ffprobe.stdout).text();
            const exitCode = await ffprobe.exited;

            if (exitCode !== 0) {
                throw new Error(`ffprobe exited with code ${exitCode}`);
            }

            const metadata = JSON.parse(output);
            const tags = metadata.format?.tags ?? {};
            return {
                source: "local",
                name: tags.title ?? "",
                id: metadata.format?.filename ?? file,
                duration: Math.floor(metadata.format?.duration ?? 0) * 1000,
                releasedDate: "",
                artist: [
                    {
                        id: "", name: tags.artist ?? "Unknown Artist"
                    }
                ],
                thumbnail: await this.getThumbnail(file),
                fileModifiedAt: await this.getFileModifiedAt(file),
            };
        } catch (e) {
            writeLogs([{ type: "error", message: `Failed to parse file ${file}: ${e}` }]);
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
                        writeLogs([{ type: "error", message: e.message }]);
                        return null;
                    });

                    processingPromises.push(task);
                }
            }
        }
        const rawResults = await Promise.all(processingPromises);

        const result: Track[] = rawResults.filter((item) => item !== null);
        await Bun.write(Bun.file("E:\\coding\\kuumoapp\\test\\test.json"), JSON.stringify(result))
        writeLocalFiles(result);

        return result;
    }
}