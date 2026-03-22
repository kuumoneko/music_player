import { readdirSync } from "node:fs";
import { extname, join } from "node:path";
import { getDataFromDatabase, writeDataToDatabase } from "../lib/database.ts";
import { spawn } from "node:child_process";
import { Track } from "@/shared/types.ts";

export class Local {
    public data: Track[] = [];
    public folder: string = "";
    public appPath: string = "";

    constructor(path: string, appPath: string) {
        this.folder = path;
        this.appPath = appPath;
    }

    get_Thumbnail(file: string): Promise<string> {
        return new Promise((resolve) => {
            const ffmpeg = spawn(`${this.appPath}/bin/ffmpeg.exe`, [
                '-i', `"${file}"`,
                '-an',
                '-vcodec', 'mjpeg',
                '-f', 'image2pipe',
                '-'
            ], { shell: true });

            let chunks = [];
            let errorOutput = '';

            ffmpeg.stdout.on('data', (chunk) => {
                chunks.push(chunk);
            });

            ffmpeg.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });

            ffmpeg.on('close', (code) => {
                if (code === 0 && chunks.length > 0) {
                    const buffer = Buffer.concat(chunks);
                    const base64Image = buffer.toString('base64');
                    resolve(`data:image/jpeg;base64,${base64Image}`);
                } else {
                    resolve("");
                }
            });
        });
    }

    async parseFile(file: string): Promise<Track> {
        return new Promise((resolve, reject) => {
            try {
                const ffprobe = spawn(`${this.appPath}/bin/ffprobe.exe`, [
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
                                thumbnail: await this.get_Thumbnail(file)
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
        if (folder.length === 0) return []
        const dirents = readdirSync(folder, {
            withFileTypes: true,
        });
        const local_files = await getDataFromDatabase(this.folder, "local");

        const audioExtensions = [".mp3", ".wav", ".flac", ".m4a", ".ogg", ".aac"];

        const audiofiles = dirents.filter(
            (dirent) =>
                dirent.isFile() &&
                audioExtensions.includes(extname(dirent.name).toLowerCase())
        );
        const file: any[] = [];
        audiofiles.forEach((dirent: any) => {
            const filePath = join(folder, dirent.name);
            const get_data = local_files.find((item: any) => {
                return item.path === filePath
            })

            if (!get_data || get_data.thumbnail.length === 0) {
                file.push(this.parseFile(filePath).then((data: any) => {
                    this.data.push(data);
                }).catch((e: any) => {
                    console.error(e)
                }))
            }
            else {
                this.data.push(get_data)
            }
        })
        await Promise.all(file);
        writeDataToDatabase(this.folder, "local", this.data);
    }
}