import { join } from "node:path";
import { spawn } from "node:child_process";
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
        try {
            const ffmpeg = Bun.spawn([
                `${this.appPath}/ffmpeg.exe`,
                '-i', file,
                '-an',
                '-vframes', '1',
                '-vcodec', 'mjpeg',
                '-f', 'image2pipe',
                '-'
            ], {
                stdout: "pipe",
                stderr: "ignore",
            });

            const buffer = await new Response(ffmpeg.stdout).arrayBuffer();

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

    async parseFile(file: string): Promise<Track> {
        return new Promise((resolve, reject) => {
            try {
                const ffprobe = spawn(`${this.appPath}/ffprobe.exe`, [
                    '-v', 'quiet',
                    '-print_format', 'json',
                    '-show_format',
                    '-show_streams',
                    `"${file}"`
                ], { shell: true });

                let output = '';
                let errorOutput = '';

                ffprobe.stdout.on('data', (data) => {
                    output += data.toString();
                });

                ffprobe.stderr.on('data', (data) => {
                    errorOutput += data.toString();
                });

                ffprobe.on('close', async (code) => {
                    if (code === 0) {
                        try {
                            const metadata = JSON.parse(output);
                            resolve({
                                source: "local",
                                name: metadata.format.tags.title,
                                id: metadata.format.filename,
                                duration: Math.floor(metadata.format.duration) * 1000,
                                releasedDate: "",
                                artist: [
                                    {
                                        id: "", name: metadata.format.tags.artist
                                    }
                                ],
                                thumbnail: await this.getThumbnail(file)
                            });
                        } catch (e) {
                            reject(new Error("Failed to parse ffprobe output."));
                        }
                    } else {
                        reject(new Error(`ffprobe exited with code ${code}: ${errorOutput}`));
                    }
                });
            }
            catch (e) {
                reject(e)
            }
        })
    }

    async getfolder(folder: string) {
        if (folder.length === 0) return [];
        const local_files = getAllLocalFiles();
        const localFilesMap = new Map(local_files.map((item: any) => [item.path, item]));

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
                    const get_data = localFilesMap.get(filePath);

                    if (!get_data || !get_data.thumbnail || get_data.thumbnail.length === 0) {

                        processingPromises.push(
                            this.parseFile(filePath)
                                .catch((e: any) => {
                                    writeLogs([{ type: "error", message: e.message }]);
                                    return null;
                                })
                        );
                    } else {
                        processingPromises.push(Promise.resolve(get_data));
                    }
                }
            }
        }
        const rawResults = await Promise.all(processingPromises);

        const result: Track[] = rawResults.filter((item) => item !== null);

        writeLocalFiles(result);

        return result;
    }
}