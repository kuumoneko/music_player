import { readdirSync } from "node:fs";
import { extname, join, basename } from "node:path";
import { getDataFromDatabase, writeDataToDatabase } from "../lib/database.ts";
import { execFile, spawn } from "node:child_process";

export class Local {
    public data: any[] = [];
    public folder: string = "";
    public appPath: string = "";


    constructor(path: string, appPath: string) {
        this.folder = path;
        this.appPath = appPath;
    }

    get_Thumbnail(file: string): Promise<string> {
        return new Promise((resolve) => {
            const ffmpeg = spawn(`${this.appPath}/bin/ffmpeg.exe`, [
                '-i', file,
                '-map', '0:v',
                '-f', 'image2',
                '-vframes', '1',
                'pipe:1'
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

    async parseFile(file: string): Promise<{
        title: string, artist: string, duration: number, thumbnail: string
    }> {
        return new Promise((resolve, reject) => {
            try {
                execFile(`${this.appPath}/bin/ffprobe.exe`, [
                    '-v', 'quiet',
                    '-print_format', 'json',
                    '-show_format', file], (err, stdout, stderr) => {
                        if (err) {
                            console.log(stderr);
                        }
                        const metadata = JSON.parse(stdout);
                        resolve(metadata);
                    })
                // const ffprobe = spawn(`${this.appPath}/bin/ffprobe.exe`, [
                //     '-v', 'quiet',
                //     '-print_format', 'json',
                //     '-show_format',
                //     '-show_streams',
                //     file
                // ], { shell: true });

                // let output = '';
                // let errorOutput = '';

                // ffprobe.stdout?.on('data', (data) => {
                //     output += data.toString();
                // });

                // ffprobe.stderr?.on('data', (data) => {
                //     errorOutput += data.toString();
                // });

                // ffprobe.on('close', (code) => {
                //     if (code === 0) {
                //         try {
                //             const metadata = JSON.parse(output);
                //             resolve(metadata);
                //         } catch (e) {
                //             reject(new Error("Failed to parse ffprobe output."));
                //         }
                //     } else {
                //         reject(new Error(`ffprobe exited with code ${code}: ${errorOutput}`));
                //     }
                // });
            }
            catch (e) {
                reject(e)
            }
        })
    }

    async getfolder(folder: string) {
        const dirents = readdirSync(folder, {
            withFileTypes: true,
        });
        const local_files = getDataFromDatabase(this.folder, "local");

        const audioExtensions = [".mp3", ".wav", ".flac", ".m4a", ".ogg", ".aac"];

        const audiofiles = dirents.filter(
            (dirent) =>
                dirent.isFile() &&
                audioExtensions.includes(extname(dirent.name).toLowerCase())
        );
        const file: any[] = [];
        audiofiles.forEach((dirent: any) => {
            // const filePath = join(folder, dirent.name);
            // split to name and extension, then remove the space if there is in the char[0] or [-1]
            const ext = extname(dirent.name);
            const name = basename(dirent.name, ext).trim();
            // if there is emoji or icon in name, remove it
            const emojiAndSymbolPattern = /[\u2600-\u27FF\u2B00-\u2BFF\u2300-\u23FF\u{1F000}-\u{1FFFF}\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F900}-\u{1F9FF}]/gu;
            const cleanedName = name.replace(emojiAndSymbolPattern, "").trim();

            const filePath = join(folder, cleanedName + ext);

            // console.log(cleanedName + ext)
            const get_data = local_files.find((item: any) => {
                return item.path === filePath
            })

            if (get_data !== null && get_data !== undefined) {
                this.data.push(get_data)
            }
            else {
                file.push(this.parseFile(filePath).then((data: any) => {
                    this.data.push({
                        source: "local",
                        name:
                            data.title ||
                            basename(dirent.name, extname(dirent.name)),
                        id: `${dirent.name}`,
                        duration: (data.duration || 0) * 1000,
                        releasedDate: "",
                        artist: [{ name: data.artist, id: "" }],
                        thumbnail: data.thumbnail,
                        path: filePath
                    });
                }).catch((e: any) => {
                    console.error(e)
                }))
            }


        })
        await Promise.all(file);
        writeDataToDatabase(this.folder, "local", this.data);
    }
}