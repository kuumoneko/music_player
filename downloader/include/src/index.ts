import { Downloader_options, Audio_format, download_mode, Download_queue } from "./type.ts";
import { spawn } from "node:child_process"
import { existsSync, readdirSync, unlinkSync, readFileSync } from "node:fs";
import { Buffer } from "node:buffer";
import { console } from "node:inspector";
import { truncate } from "node:fs/promises";


export default class Downloader {
    private folder: string = ""
    private audio_format: string = Audio_format.mp3;
    private ytdlp: string | undefined;
    private spotdlp: string | undefined;
    private ffmpeg: string | undefined;
    private checking_queue: Download_queue[] = [];
    private download_queue: Download_queue[] = [];
    private maxResults = 200;
    private youtube_api_key: string | undefined;
    private spotify_api_key: string | undefined;
    private spotify_client_id: string | undefined;
    private token: string | undefined = "";
    private spot_errors: string | undefined = "";

    constructor(options: Downloader_options) {
        // folder
        this.folder = options.download_folder || "";

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

    format_title(title: string) {
        const emojiPattern = new RegExp(
            "[\u2600-\u27BF\u2B00-\u2BFF\u2300-\u23FF\u1F000-\u1FFFF]", "gu"
        );
        const regionalIndicatorPattern = new RegExp(
            "[\u1F1E6-\u1F1FF]{2}", "gu"
        );
        const invalidCharsPattern = /[|/?*:<>]/g;
        const multipleSpacesPattern = /\s+/g;
        const trimSpacesPattern = /(^\s+|\s+$)/g;
        let cleanedTitle = title;

        cleanedTitle = cleanedTitle.replaceAll(regionalIndicatorPattern, "");
        cleanedTitle = cleanedTitle.replaceAll(emojiPattern, "");
        cleanedTitle = cleanedTitle.replaceAll(invalidCharsPattern, "");
        cleanedTitle = cleanedTitle.replaceAll(multipleSpacesPattern, " ");
        cleanedTitle = cleanedTitle.replaceAll(trimSpacesPattern, "");

        return cleanedTitle;
    }

    async fetchPlaylistVideos(id: string = '', pagetoken: string = ''): Promise<any> {
        const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=${this.maxResults}&playlistId=${id}&key=${this.youtube_api_key}&pageToken=${pagetoken}`;
        const response = await fetch(url);
        const data = await response.json();
        return data;
    }

    async fetchVideos(id: string = ''): Promise<any> {
        const pagetoken = '';
        // https://youtube.googleapis.com/youtube/v3/videos?part=snippet%2CcontentDetails%2Cstatistics&id=Ks-_Mh1QhMc&key=[YOUR_API_KEY]'
        const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${id}&key=${this.youtube_api_key}&pageToken=${pagetoken}`;
        const response = await fetch(url);
        const data = await response.json();
        return data;
    }

    async search_youtube_video(search: string = ''): Promise<any> {
        const pagetoken = '';
        const url = `https://youtube.googleapis.com/youtube/v3/search?part=snippet&maxResults=25&q=${search}&key=${this.youtube_api_key}&pageToken=${pagetoken}`
        const response = await fetch(url);
        const data = await response.json();
        return data;
    }

    async fetchPlaylistVideos_spotify(id: string = '') {
        const url = `https://api.spotify.com/v1/playlists/${id}?fields=tracks.items%28track%28name%2Cid%29%29`;
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${this.token}` },
        });
        const data = await response.json();
        return data;
    }

    async fetchTrackVideos_spotify(id: string = '') {
        const url = `https://api.spotify.com/v1/tracks/${id}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${this.token}` },
        });
        const data = await response.json();
        return data;
    }

    async fetchAlbumVideos_spotify(id: string = '') {
        const url = `https://api.spotify.com/v1/album/${id}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${this.token}` },
        });
        const data = await response.json();

        return data;
    }

    async get_all_videos_from_playlist(id: string = '') {
        // console.log(id)
        let videos: any[] = [];
        let pageToken = '';
        do {
            const data = await this.fetchPlaylistVideos(id, pageToken);
            videos = videos.concat(data.items);
            pageToken = data.nextPageToken;
        } while (pageToken);

        videos.forEach((video: any) => {
            // console.log(video)
            const temping = {
                link: `https://www.youtube.com/watch?v=${video.snippet.resourceId.videoId}`,
                title: this.format_title(video.snippet.title),
                mode: "music",
                format: `${this.audio_format}`,
                from: "youtube"
            }
            // this.download_queue.push(temping)
            this.checking_queue.push(temping)
        })
    }

    async get_all_videos_from_playlist_spotify(id: string = '') {
        let videos: any[] = [];
        let pageToken = '';
        do {
            const data = await this.fetchPlaylistVideos_spotify(id);
            videos = videos.concat(data.tracks.items);
            pageToken = data.nextPageToken;
        } while (pageToken);

        videos.forEach((video: any) => {
            this.checking_queue.push({
                link: `https://open.spotify.com/track/${video.track.id}`,
                title: video.track.name,
                mode: "music",
                format: `${this.audio_format}`,
                from: "spotify"
            })
        })
    }

    async get_all_videos_from_album_spotify(id: string = '') {
        let videos: any[] = [];
        let pageToken = '';
        do {
            const data = await this.fetchAlbumVideos_spotify(id);
            videos = videos.concat(data.tracks.items);
            pageToken = data.nextPageToken;
        } while (pageToken);

        videos.forEach((video: any) => {
            this.checking_queue.push({
                link: `https://open.spotify.com/track/${video.track.id}`,
                title: video.track.name,
                mode: "music",
                format: `${this.audio_format}`,
                from: "spotify"
            })
        })
    }

    async add_link(link: string) {
        // console.log(link)
        // if link from youtube
        if (link.includes("youtu")) {
            const youtube_link = link.split(link.includes("?si=") ? "?si=" : "&si=")[0];
            // console.log(youtube_link)
            // short form
            let temp: string = "";
            if (youtube_link.includes("youtu.be")) {
                temp = youtube_link.split("youtu.be/")[1];
            }
            // long form
            else if (youtube_link.includes("youtube.com")) {
                if (youtube_link.includes("watch")) {
                    temp = youtube_link.split("watch?v=")[1]
                }
                else if (youtube_link.includes("list")) {
                    temp = youtube_link.split("?list=")[1]
                }
            }
            if (temp.length > 20) {
                // console.log("lmao")
                await this.get_all_videos_from_playlist(temp);
                const temping = {
                    link: youtube_link,
                    title: '',
                    mode: "music",
                    format: `${this.audio_format}`,
                    from: "youtube"
                }
                this.download_queue.push(temping)
            }
            else {
                const youtube_videos = await this.fetchVideos(temp);
                const temping = {
                    link: `https://www.youtube.com/watch?v=${youtube_videos.items[0].id}`,
                    title: this.format_title(youtube_videos.items[0].snippet.title),
                    mode: "music",
                    format: `${this.audio_format}`,
                    from: "youtube"
                }
                this.checking_queue.push(temping)
                this.download_queue.push(temping)
            }
        }
        // if link from spotify
        else if (link.includes("spot")) {

            if (this.token == "") {
                var client_id = this.spotify_client_id;
                var client_secret = this.spotify_api_key;
                const response = await fetch('https://accounts.spotify.com/api/token', {
                    method: 'POST',
                    body: new URLSearchParams({
                        'grant_type': 'client_credentials',
                    }),
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Authorization': 'Basic ' + (Buffer.from(client_id + ':' + client_secret).toString('base64')),
                    },
                });

                const data = await response.json();
                this.token = data.access_token;
            }

            let spotify_link = link.split(link.includes("?si=") ? "?si=" : "&si=")[0];
            const mode = spotify_link.includes("playlist") ? "playlist" : spotify_link.includes("track") ? "track" : "album"
            spotify_link = spotify_link.split(mode)[1].split("/")[1]

            if (mode == "playlist") {
                await this.get_all_videos_from_playlist_spotify(spotify_link)
                this.download_queue.push({
                    link: `https://open.spotify.com/playlist/${spotify_link}`,
                    title: "",
                    mode: "music",
                    format: `${this.audio_format}`,
                    from: "spotify"
                })
            }
            else if (mode == "album") {
                await this.get_all_videos_from_album_spotify(spotify_link)
                this.download_queue.push({
                    link: `https://open.spotify.com/album/${spotify_link}`,
                    title: "",
                    mode: "music",
                    format: `${this.audio_format}`,
                    from: "spotify"
                })
            }
            else if (mode == "track") {
                const video = await this.fetchTrackVideos_spotify(spotify_link);
                this.checking_queue.push({
                    link: `https://open.spotify.com/track/${video.id}`,
                    title: this.format_title(video.name),
                    mode: "music",
                    format: `${this.audio_format}`,
                    from: "spotify"
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
        // writeFileSync("../BE/download.json", JSON.stringify(this.download_queue), { encoding: "utf8" })
        // writeFileSync("../BE/checking.json", JSON.stringify(this.checking_queue), { encoding: "utf8" })
    }

    download_Youtube_mp3(video: Download_queue): Promise<string> {
        return new Promise((resolve, reject) => {
            const child = spawn(this.ytdlp as string, [
                "--ffmpeg-location", this.ffmpeg as string,
                "-x", '--audio-format', `${this.audio_format}`,
                '--no-write-thumbnail', '--embed-thumbnail', '--embed-metadata', '-w',
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
                video.link
            ], {
                stdio: [
                    "ignore", 'inherit', 'ignore'
                ]
            });

            child.on('close', async (code: number) => {
                const temp = readFileSync(this.spot_errors as string, "utf-8");
                const error_line = temp.split("\n").filter((data: string) => {
                    return data.includes("AudioProviderError")
                })
                for (const error of error_line) {
                    const error_video = error.split(' - ')[0]
                    const error_spot = await this.fetchTrackVideos_spotify(error_video.split("/track/")[1]) as any;
                    const search_on_youtube = await this.search_youtube_video(error_spot.name);
                    const video = search_on_youtube.items[0];
                    const temping = {
                        link: `https://www.youtube.com/watch?v=${video.id.videoId}`,
                        title: "",// this.format_title(error_spot.name),
                        mode: "music",
                        format: `${this.audio_format}`,
                        from: "youtube"
                    }
                    // this.checking_queue.push(temping)
                    this.download_queue.push(temping)
                }
                resolve(`Finish download ${video.title}${this.audio_format}`);
            });
            child.on('error', (error) => {
                reject(error);
            });
        })
    }

    async checking() {
        // get all filename in a folder
        const files = readdirSync(this.folder);
        for (const file of files) {
            const checked = this.checking_queue.find(item => item.title == file.split(`${this.audio_format}`)[0])
            if (!checked) {
                // delete that file in download folder
                try {
                    unlinkSync(`${this.folder}\\${file}`); // Delete the file
                    console.warn(`Deleted: ${file}`);
                } catch (error) {
                    console.error(`Error deleting ${file}:`, error);
                }
            }
        }
    }

    async download() {
        while (this.download_queue.length > 0) {
            const downloader = this.download_queue.shift() as Download_queue;
            try {
                if (!existsSync(`${this.folder}\\${downloader.title}${this.audio_format}`)) {
                    if (downloader.from == "spotify") {
                        await this.download_Spotify_mp3(downloader)
                    }
                    else if (downloader.from == "youtube") {
                        await this.download_Youtube_mp3(downloader)
                    }
                }
            }
            catch (e) {
                console.error(e)
            }
        }
    }
}