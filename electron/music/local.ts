import ffmpeg from "fluent-ffmpeg"
import { app } from "electron"
import { PassThrough } from "node:stream"
import { readdirSync } from "node:fs";
import { extname, join, basename } from "node:path";
import { getDataFromDatabase, writeDataToDatabase } from "../lib/database.ts";

let ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
let ffprobePath = require('@ffprobe-installer/ffprobe').path
if (app.isPackaged) {
    ffmpegPath = ffmpegPath.replace('app.asar', 'app.asar.unpacked');
    ffprobePath = ffprobePath.replace('app.asar', 'app.asar.unpacked');
}

export class Local {
    public data: any[] = [];
    public folder: string = "";

    constructor(path: string) {
        this.folder = path;
        ffmpeg.setFfmpegPath(ffmpegPath);
        ffmpeg.setFfprobePath(ffprobePath);
    }

    get_Thumbnail(path: string): Promise<string> {
        return new Promise((resolve) => {
            const imageStream = new PassThrough();
            let chunks: any[] = [];

            imageStream.on('data', (chunk) => {
                chunks.push(chunk);
            });

            imageStream.on('end', () => {
                const buffer = Buffer.concat(chunks);
                const base64Image = buffer.toString('base64');
                resolve(`data:image/jpeg;base64,${base64Image}`)
            });

            ffmpeg(path, { timeout: 60000 })
                .outputFormat('mjpeg')
                .frames(1)
                .on('error', () => {
                    const buffer = Buffer.concat(chunks);
                    const base64Image = buffer.toString('base64');
                    resolve(`data:image/jpeg;base64,${base64Image}`)
                })
                .pipe(imageStream, { end: true });
        })
    }

    async parseFile(file: string): Promise<{
        title: string, artist: string, duration: number, thumbnail: string
    }> {
        return new Promise((resolve, reject) => {
            try {
                ffmpeg.ffprobe(file, async (err, metadata) => {
                    if (err) {
                        console.error('Error while probing file:', err);
                        return;
                    }

                    const duration = metadata.format.duration;
                    const tags = metadata.format.tags;
                    const title = tags ? tags.title : 'N/A';
                    const artist = tags ? tags.artist : 'N/A';
                    const thumbnail = await this.get_Thumbnail(file);

                    resolve({
                        title: title as string,
                        artist: artist as string,
                        duration: duration as number,
                        thumbnail: thumbnail
                    })
                })
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
            const filePath = join(folder, dirent.name);
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