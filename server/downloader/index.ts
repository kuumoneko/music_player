import { existsSync, readdirSync, unlinkSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import fs from 'node:fs';
import path from 'node:path';

import ffmpeg from "fluent-ffmpeg";

import { Downloader_options, Audio_format, Status, Download_item, Track } from "../types/index.js";
import Music from "./music/index.js";
import Get_playback_url from "./playback/index.js";

export default class Downloader {
    public folder: string = ""
    public audio_format: string = Audio_format.mp3;
    public download_queue: Download_item[] = [];
    public curr_folder: string | undefined = "";
    public stastus: { data: string, track: string } = { data: Status.idle, track: "" };
    public port: number = 3000;
    public music: Music;

    constructor(options: Downloader_options) {
        // folder
        this.folder = options.download_folder || "";
        this.curr_folder = options.curr_folder || "";

        // options
        this.audio_format = options.audio_format || Audio_format.m4a;

        // client API
        this.music = new Music({
            youtube_api_key: options.youtube_api_key,
            spotify_api_key: options.spotify_api_key,
            spotify_client: options.spotify_client,
            google_client_id: options.google_client_id,
            google_client_secret: options.google_client_secret,
            redirect_uris: options.redirect_uris,
            port: options.port || 3000,
            endpoints: options.endpoints,
            database: options.curr_folder || ""
        })

        // status
        this.stastus = { data: Status.idle, track: "" };
    }

    get_status(): { status: { data: string, track: string } } {
        return { status: this.stastus, };
    }

    set_status(data: string, track: string) {
        this.stastus = {
            data, track
        };
    }

    set_download_foler(str: string) {
        this.folder = str;
    }

    set_audio_format(format: Audio_format) {
        this.audio_format = format;
    }

    clear_links() {
        this.download_queue = [];
    }

    get_download_folder() {
        return this.folder
    }

    get_audio_format() {
        return this.audio_format
    }

    get_queue() {
        return this.download_queue;
    }

    format_title(title: string): string {
        const emojiAndSymbolPattern =
            /[\u2600-\u27FF\u2B00-\u2BFF\u2300-\u23FF\u{1F000}-\u{1FFFF}\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F900}-\u{1F9FF}]/gu;
        const regionalIndicatorPattern = /[\u{1F1E6}-\u{1F1FF}]{2}/gu;
        const invalidCharsPattern = /[|/?*:<>"]/g;
        const multipleSpacesPattern = /\s+/g;
        const trimSpacesPattern = /(^\s+|\s+$)/g;
        let cleanedTitle = title;

        cleanedTitle = cleanedTitle.replace(regionalIndicatorPattern, "");
        cleanedTitle = cleanedTitle.replace(emojiAndSymbolPattern, "");
        cleanedTitle = cleanedTitle.replace(invalidCharsPattern, "");
        cleanedTitle = cleanedTitle.replace(multipleSpacesPattern, " ");
        cleanedTitle = cleanedTitle.replace(trimSpacesPattern, "");

        return cleanedTitle;
    }

    async checking(): Promise<void> {
        const files = readdirSync(this.folder, {
            withFileTypes: true
        });
        for (const file of files) {
            if (!file.isFile()) {
                return;
            }
            const ext = path.extname(file.name)
            const filename = path.basename(file.name, ext);

            const checked = this.download_queue.filter((item) => item.title.includes(filename));
            if (checked.length === 0) {
                try {
                    unlinkSync(`${this.folder}\\${file}`);
                    console.log(`Deleted: ${filename}`);
                } catch (error) {
                    console.error(`Error deleting ${filename}:`, error);
                }
            }
            else {
                console.log(`No Deleted: ${filename}`);
            }
        }
    }

    sleep(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    donwloading(title: string, id: string, metadata: { artist: string, year: string, thumbnail: string }): Promise<any> {
        return new Promise(async (resolve, reject) => {
            const __dirname = this.folder,
                outputFileName = `${title}.${this.audio_format}`,
                outputPath = path.resolve(__dirname, outputFileName), { artist, year, thumbnail } = metadata;

            let tempThumbnailPath: string | null = null;

            try {
                this.set_status(`Preparing for`, title)
                console.log(`Fetching info for videos ${title}`);
                const data = this.music.youtube.getdata("tracks", id);

                const music_url: string = data.music_url;
                let download_url: string = ""
                if (music_url) {
                    const is_invalid_link = await fetch(music_url);
                    if (is_invalid_link.ok) {
                        download_url = music_url;
                    }
                    else {
                        download_url = await this.getAudioURLAlternative(id)
                        data.music_url = download_url;
                        this.music.youtube.writedata("tracks", id, data);
                    }
                }
                else {
                    download_url = await this.getAudioURLAlternative(id)
                    data.music_url = download_url;
                    this.music.youtube.writedata("tracks", id, data);
                }
                const command = ffmpeg(download_url);

                // Embed metadata
                if (title) command.outputOptions('-metadata', `title=${title}`);
                if (artist) command.outputOptions('-metadata', `artist=${artist}`);
                if (year) command.outputOptions('-metadata', `year=${year}`);

                // Set output codec for format
                command
                    .audioCodec((this.audio_format === Audio_format.mp3 ? "libmp3lame" : "aac"))
                    .audioBitrate(192)
                    .outputOptions([
                        '-map', '0:a'
                    ]);

                if (thumbnail) {
                    console.log(`Downloading thumbnail from: ${thumbnail}`);
                    const response = await fetch(thumbnail);
                    const arrayBuffer = await response.arrayBuffer();
                    const thumbnailBuffer = Buffer.from(arrayBuffer);

                    // Determine image format (e.g., .jpg, .png) from content type or guess
                    const contentType = response.headers['content-type'] || 'image/jpeg'; // Default to jpeg
                    let ext = '.jpg';
                    if (contentType.includes('png')) {
                        ext = '.png';
                    } else if (contentType.includes('jpeg')) {
                        ext = '.jpeg';
                    }

                    tempThumbnailPath = path.resolve(__dirname, `temp_thumbnail_123${ext}`);
                    await fs.promises.writeFile(tempThumbnailPath, thumbnailBuffer);
                    console.log(`Thumbnail downloaded to: ${tempThumbnailPath}`);

                    // add thumbnail to 
                    command.addInput(tempThumbnailPath)
                        .addOutputOptions([
                            '-map', '1:v',
                            '-c:v', 'copy',
                            '-disposition:v:0', 'attached_pic'
                        ]);
                }

                command
                    .on('start', (commandLine) => {
                        console.log('FFmpeg command started:', commandLine);
                        this.set_status(`Download `, title)

                    })
                    .on('progress', (progress) => {
                        console.log(`Processing: ${progress.percent} %`);
                        this.set_status(`Download ${title}`, `${progress.percent?.toFixed(2)} % `)
                    })
                    .on('end', async () => {
                        console.log(`\nDownload and metadata embedding finished for "${title}". Saved to: ${outputPath}`);
                        this.set_status(`Finished downloading `, title)
                        if (tempThumbnailPath && fs.existsSync(tempThumbnailPath)) {
                            await fs.promises.unlink(tempThumbnailPath).catch(cleanUpErr => console.error('Error during emergency cleanup:', cleanUpErr));
                        }
                        resolve("ok");
                    })
                    .on('error', async (err) => {
                        throw new Error(err.message, { cause: err.cause });
                    })
                    .save(outputPath);
            } catch (error) {
                console.log(error)
                if (tempThumbnailPath && fs.existsSync(tempThumbnailPath)) {
                    await fs.promises.unlink(tempThumbnailPath).catch(cleanUpErr => console.error('Error during emergency cleanup:', cleanUpErr));
                }
                reject("not oke");
            }
        })
    }

    converting(...args: string[]): Promise<any> {
        return new Promise(async (resolve) => {
            const [name, input, output] = args;
            const inputFile = `${this.folder}/${name}.${input}`;
            const outputFile = `${this.folder}/${name}.${output}`;

            ffmpeg(inputFile)
                .toFormat(output)
                .on('end', () => {
                    resolve("ok")
                })
                .on('error', (err: any) => {
                    throw new Error(err);
                })
                .save(outputFile);
        })
    }

    async download() {
        await mkdir(`${this.folder}`, { recursive: true })

        while (this.download_queue.length > 0) {
            const downloader = this.download_queue.shift() as Download_item,
                { title, id, metadata } = downloader,
                formats = [Audio_format.m4a, Audio_format.mp3],
                file_name = `${this.folder}\\${title}`;

            let isExisted = false,
                is_converted = false,
                curr_format: Audio_format = Audio_format.m4a;

            for (const format of formats) {
                const fileName = file_name + "." + format;
                if (existsSync(fileName)) {
                    isExisted = true;
                    if (format !== this.audio_format) {
                        is_converted = true;
                        curr_format = format
                    }
                    break;
                }
            }

            console.log(`${file_name} is ${!isExisted === true ? "not" : ""} existed`)
            const downloaded_id = id[id.length - 1]
            try {
                const formated_title = this.format_title(title)
                if (!isExisted) {
                    console.log(`download new file ${formated_title}`)
                    await this.donwloading(formated_title, downloaded_id, metadata)
                }
                else if (is_converted) {
                    console.log(`Convert ${formated_title} from ${curr_format} to ${this.audio_format}`)
                    await this.converting(formated_title, curr_format, this.audio_format)
                }
            }
            catch (e) {
                console.error(e)
                const source = metadata.source;

                const track: Track[] = await this.music.youtube.fetch_track([id[0]]);
                const data = await this.music.findMatchingVideo(track[0], id);
                if (data) {
                    this.download_queue.push({
                        title: this.format_title(data.track?.name as string) || "",
                        id: [...id, data.track?.id || ''],
                        metadata: {
                            artist: (data.artists as any)[0].name || "",
                            year: data.track?.releaseDate || "",
                            thumbnail: data.thumbnail || "",
                            source: source
                        }
                    })
                }
            }
        }
        this.set_status(Status.done, "");
        await this.sleep(5000).then(() => {
            this.set_status(Status.idle, "");
        })
    }

    getAudioURLAlternative(id: string): Promise<string> {
        return new Promise(async (resolve, reject) => {
            try {
                const url = await Get_playback_url(id);
                resolve(url)
            } catch (error) {
                throw new Error(error)
            }
        })
    }
}
