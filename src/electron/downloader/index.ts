/* eslint-disable @typescript-eslint/no-unused-vars */
import { Downloader_options, Audio_format, download_mode, Download_queue, Status, Track, Mode } from "../types/index.ts";
import { spawn } from "node:child_process"
import { existsSync, readdirSync, unlinkSync, readFileSync } from "node:fs";
import { truncate, mkdir, access, unlink, constants } from "node:fs/promises";
import download_ffmpeg from './env/install_ffmpeg.ts'
import download_ytdlp from './env/yt-dlp_download.ts'
import download_spotdlp from './env/spot-dlp_download.ts'
import Music from "./music/index.ts";
import ytdl from "@distube/ytdl-core";

function zip(currpath: string, path: string, filename: string) {
    return new Promise((resolve, reject) => {
        const child = spawn(`${currpath}\\support\\7z.exe a "${path}\\${filename}.7z" "${path}"`, { stdio: "inherit", shell: true })
        child.on('close', async () => {
            resolve("ok")
        })
    })
}

export default class Downloader {
    public folder: string = ""
    public audio_format: string = Audio_format.mp3;
    public ytdlp: string | undefined;
    public spotdlp: string | undefined;
    public ffmpeg: string | undefined;
    public checking_queue: Download_queue[] = [];
    public download_queue: Download_queue[] = [];
    public youtube_api_key: string[] | undefined;
    public spotify_api_key: string | undefined;
    public spotify_client_id: string | undefined;
    public spot_errors: string | undefined = "";
    public curr_folder: string | undefined = "";
    public stastus: Status = Status.idle;
    public port: number = 3000;
    public music: Music;
    public mode: Mode


    constructor(options: Downloader_options, mode: Mode) {
        // folder
        this.folder = options.download_folder || "";
        this.curr_folder = options.curr_folder || "";

        // options
        this.spot_errors = options.spot_errors || "";
        this.audio_format = options.audio_format || Audio_format.m4a;
        this.ytdlp = options.ytdlp;
        this.spotdlp = options.spotdlp;
        this.ffmpeg = options.ffmpeg;

        // client API
        this.youtube_api_key = options.youtube_api_key;
        this.spotify_api_key = options.spotify_api_key;
        this.spotify_client_id = options.spotify_client;
        this.music = new Music({
            youtube_api_key: this.youtube_api_key,
            spotify_api_key: this.spotify_api_key,
            spotify_client: this.spotify_client_id,
            google_client_id: options.google_client_id,
            google_client_secret: options.google_client_secret,
            redirect_uris: options.redirect_uris,
            port: options.port || 3000,
        })

        // status
        this.stastus = Status.idle;
        this.mode = mode
    }


    async get_status(): Promise<any> {
        return {
            status: this.stastus,

        };
    }

    getdownload() {
        this.stastus = Status.idle;
        return `${this.folder}\\download.7z`
    }

    set_status(status: Status) {
        this.stastus = status;
    }

    set_download_foler(str: string) {
        this.folder = str;
    }

    set_audio_format(format: Audio_format) {
        this.audio_format = format;
    }

    clear_links() {
        this.checking_queue = [];
        this.download_queue = [];
    }

    get_download_folder() {
        return this.folder
    }

    get_audio_format() {
        return this.audio_format
    }

    get_ytdlp() {
        return this.ytdlp
    }

    get_spotdlp() {
        return this.spotdlp
    }

    get_ffmpeg() {
        return this.ffmpeg
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

    async add_link(link: string) {
        const { source, mode, id } = this.music.convert_link(link);

        const videos = await this.music.search(link);
        // console.log(videos)
        if (videos.error) {
        }
        else {
            this.download_queue.push({
                link: (source === "youtube") ? `https://www.youtube.com/${mode}?${mode === "watch" ? "v" : "list"}=${id}&rco=1` : `https://open.spotify.com/${mode}/${id}`,
                title: "",
                mode: download_mode.audio,
                format: this.audio_format,
                from: videos.type.split(":")[0]
            })

            if (mode === "playlist") {
                this.checking_queue.push(...videos.tracks.map((video: Track) => {
                    return {
                        link: (videos.type.split(":")[0] === "youtube") ? `https://www.youtube.com/watch?v=${video.track.id}&rco=1` : `https://open.spotify.com/track/${video.track.id}`,
                        title: (videos.type.split(":")[0] === "youtube") ? this.format_title(video.track.name) : video.track.name,
                        mode: download_mode.audio,
                        format: this.audio_format,
                        from: videos.type.split(":")[0]
                    }
                }))
            }
            else if (mode === "track") {
                this.checking_queue.push({
                    link: (videos.type.split(":")[0] === "youtube") ? `https://www.youtube.com/watch?v=${videos.track.id}&rco=1` : `https://open.spotify.com/track/${videos.track.id}`,
                    title: (videos.type.split(":")[0] === "youtube") ? this.format_title(videos.track.name) : videos.track.name,
                    mode: download_mode.audio,
                    format: this.audio_format,
                    from: videos.type.split(":")[0]
                })
            }
        }
    }

    async add_to_queue(options: {
        mode: download_mode,
        link: string | string[]
    }) {
        if (typeof options.link == "string") {
            const link: string = options.link;
            await this.add_link(link)
        }
        else {
            for (const link of options.link) {
                await this.add_link(link)
            }
        }
    }

    download_Youtube_mp3(video: Download_queue): Promise<string> {
        return new Promise((resolve, reject) => {
            const child = spawn(this.ytdlp as string, [
                "--ffmpeg-location", this.ffmpeg as string,
                "-x", '--audio-format', `${this.audio_format}`,
                `--download-archive`, `${this.curr_folder}\\BE\\download.txt`,
                '--no-overwrites', '--no-write-thumbnail', '--embed-thumbnail', '--embed-metadata', '-w',
                "--replace-in-metadata", "title,uploader", "[\\U00002600-\\U000027FF\\U00002B00-\\U00002BFF\\U00002300-\\U000023FF\\U0001F000-\\U0001FFFF]", "",
                "--replace-in-metadata", "title,uploader", "[\\U0001F1E6-\\U0001F1FF]{2}", "",
                "--replace-in-metadata", "title,uploader", "[|/?:*<>]", "",
                "--replace-in-metadata", "title,uploader", "\\s+", " ",
                "--replace-in-metadata", "title,uploader", "(^\\s+|\\s+$)", "",
                "-o", `${this.folder}\\%(title)s.%(ext)s`, video.link
            ], {
                stdio: "inherit"
            });
            child.on('close', (code: number) => {
                resolve(`Finish download ${video.title}${this.audio_format}`);
            });
            child.on('error', (error) => {
                reject(error);
            });
        })
    }

    download_Spotify_mp3(video: Download_queue): Promise<string> {
        truncate(this.spot_errors as string, 0);
        return new Promise(async (resolve, reject) => {
            const child = spawn(this.spotdlp as string, [
                "--ffmpeg", this.ffmpeg as string,
                "--bitrate", "192k",
                "--overwrite", "skip",
                "--save-errors", `${this.spot_errors}`,
                "--format", `${this.audio_format}`, "--preload",
                "--output", `${this.folder}\\{title}`,
                `${(video.formatlink) ? `${video.link + "|" + video.formatlink}` : `${video.link}`}`
            ], {
                stdio: "inherit"

            });

            child.on('close', async (code: number) => {
                const temp = readFileSync(this.spot_errors as string, "utf-8");
                const error_line = temp.split("\n").filter((data: string) => {
                    return data.includes("Error:")
                })
                for (const error of error_line) {
                    const error_video = error.split(' - ')[0]
                    const error_spot = await this.music.spotify.fetchTrackVideos_spotify(error_video.split("/track/")[1]) as any;
                    const search_on_youtube = await this.music.youtube.search_youtube_video(`${error_spot.artists[0].name} ${error_spot.name}}`);
                    const video = search_on_youtube.tracks[0];
                    const temping: Download_queue = {
                        link: `https://www.youtube.com/watch?v=${video.track.id}&rco=1`,
                        formatlink: error_video,
                        title: "",
                        mode: "music",
                        format: `${this.audio_format}`,
                        from: "spotify"
                    }
                    this.download_queue.push(temping)
                }
                resolve(`Finish download ${video.title}${this.audio_format}`);
            });
            child.on('error', (error) => {
                reject(error);
            });
        })
    }


    async checking(): Promise<void> {
        // get all filename in a folder
        const files = readdirSync(this.folder);
        for (const file of files) {
            const checked = this.checking_queue.find(item => item.title === file.split(`.${this.audio_format}`)[0])
            if (!checked) {
                // delete that file in download folder
                try {
                    unlinkSync(`${this.folder}\\${file}`); // Delete the file
                    console.log(`Deleted: ${file}`);
                } catch (error) {
                    console.error(`Error deleting ${file}:`, error);
                }
            }
        }
    }

    async download(mode: string): Promise<void> {
        await mkdir(`${this.folder
            }`, { recursive: true })
        this.set_status(Status.downloading)
        while (this.download_queue.length > 0) {
            const downloader = this.download_queue.shift() as Download_queue;
            try {
                if (!existsSync(`${this.folder}\\${downloader.title}${this.audio_format}`)) {
                    if (downloader.from === "spotify") {
                        await this.download_Spotify_mp3(downloader)
                    }
                    else if (downloader.from === "youtube") {
                        await this.download_Youtube_mp3(downloader)
                    }

                }
            }
            catch (e) {
                console.error(e)
            }
        }
        if (mode === "zip") {
            try {
                await access(`${this.folder}\\download.7z`, constants.F_OK);
                await unlink(`${this.folder}\\download.7z`);
            }
            catch {
            };
            await zip(this.curr_folder as string, this.folder as string, "download")
        }
        this.stastus = Status.done;
    }

    async check_env(): Promise<void> {
        const ffmpeg_path = `${this.curr_folder}\\support\\ffmpeg\\ffmpeg.exe`;
        const ffplay_path = `${this.curr_folder}\\support\\ffmpeg\\ffplay.exe`;
        const ffprobe_path = `${this.curr_folder}\\support\\ffmpeg\\ffprobe.exe`;
        const ytdlp_path = `${this.curr_folder}\\support\\yt-dlp.exe`;
        const spotdlp_path = `${this.curr_folder}\\support\\spot-dlp.exe`;

        await mkdir(`${this.curr_folder}\\support`, { recursive: true })

        if (!existsSync(ffmpeg_path) || !existsSync(ffplay_path) || !existsSync(ffprobe_path)) {
            await mkdir(`${this.curr_folder}\\temping`, { recursive: true })
            console.warn("FFmpeg not found. Downloading...");
            await download_ffmpeg(this.curr_folder as string);
        }

        if (!existsSync(ytdlp_path)) {
            console.warn("yt-dlp not found. Downloading...");
            await download_ytdlp(this.curr_folder as string)
        }

        if (!existsSync(spotdlp_path)) {
            console.warn("spot-dlp not found. Downloading...");
            await download_spotdlp(this.curr_folder as string)
        }
    }

    async getAudioURLAlternative(id: string): Promise<string> {
        try {
            const videoUrl = `https://www.youtube.com/watch?v=${id}`;

            const info = await ytdl.getInfo(videoUrl);

            const audioFormat = ytdl.chooseFormat(info.formats, {
                filter: 'audioonly',
                quality: 'highestaudio',
            });

            if (audioFormat && audioFormat.url) {
                // console.log('Audio URL:', audioFormat.url);
                return audioFormat.url; // You can return the URL to use in your React component
            } else {
                throw new Error('Could not find a valid audio URL.')
            }
        } catch (error: any) {
            throw new Error(error)
        }
    }
}
