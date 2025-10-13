import path from "node:path";
import { Audio_format, Download_item, Downloader_options, Status, Track } from "../types/index.js";
import { Local } from "./music/local.js";
import Spotify from "./music/spotify.js";
import Youtube from "./music/youtube.js";
import { readdirSync, unlinkSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import ffmpeg from "fluent-ffmpeg";
import Innertube, { ClientType } from "youtubei.js";

export default class Downloader {
    // Info
    public app_folder: string;
    public download_folder: string;
    public audio_format: Audio_format;

    // Download
    private queue: Download_item[];
    private status: { data: Status, track: string };

    // Music
    public youtube: Youtube;
    public spotify: Spotify;
    public local: Local;

    public youtube_player: Innertube;


    constructor(options: Downloader_options) {
        this.app_folder = options.curr_folder
        this.download_folder = options.download_folder;

        this.audio_format = options.audio_format;

        this.queue = [];
        this.status = { data: Status.idle, track: "" }

        this.spotify = new Spotify({
            spotify_api_key: options.spotify_api_key,
            spotify_client: options.spotify_client,
            port: options.port || 3000,
            database: path.join(options.curr_folder, "data", "spotify")
        });
        this.youtube = new Youtube({
            youtube_api_key: options.youtube_api_key,
            google_client_id: options.google_client_id,
            google_client_secret: options.google_client_secret,
            redirect_uris: options.redirect_uris,
            port: options.port || 3000,
            endpoints: options.endpoints,
            database: path.join(options.curr_folder, "data", "youtube")
        });
        this.local = new Local()
    }


    get_status(): { status: { data: string, track: string } } {
        return { status: this.status, };
    }

    set_status(data: string, track: string) {
        this.status = {
            data: data as Status, track
        };
    }

    set_download_foler(str: string) {
        this.download_folder = str;
    }

    set_audio_format(format: Audio_format) {
        this.audio_format = format;
    }

    clear_links() {
        this.queue = [];
    }

    get_download_folder() {
        return this.download_folder
    }

    set_queue(queue: Download_item[]) {
        this.queue = queue;
    }

    get_audio_format() {
        return this.audio_format
    }

    get_queue() {
        return this.queue;
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
        const files = readdirSync(this.download_folder, {
            withFileTypes: true
        });
        for (const file of files) {
            if (!file.isFile()) {
                return;
            }
            const ext = path.extname(file.name)
            const filename = path.basename(file.name, ext);

            const checked = this.queue.filter((item) => item.title.includes(filename));
            if (checked.length === 0) {
                try {
                    unlinkSync(`${this.download_folder}\\${file}`);
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

    /**
     * 
     * @param link 
     * @param where must be had if link is string
     */
    async search(link: string | { source: string, mode: string, id: string }, where: string = ""): Promise<any> {

        if (typeof link === "string" && where === "") {
            throw new Error("params where must be had if link is a string")
        }
        let { source, mode, id } = (typeof link === 'string') ? this.convert_link(link) : link;
        if (source === "youtube") {
            if (mode === "playlist") {
                return await this.youtube.fetch_playlist(id);
            }
            else {
                return await this.youtube.fetch_track([id]);
            }
        }
        else if (source === "spotify") {
            if (mode === "playlist") {
                return await this.spotify.fetch_playlist(id);
            }
            else if (mode === "album") {
                return await this.spotify.fetch_album(id);
            }
            else if (mode === "track") {
                return await this.spotify.fetch_track(id);
            }
        }
        else {
            if (where === "youtube") {
                return await this.youtube.search(link as string);
            }
            else if (where === "spotify") {
                return await this.spotify.search(link as string);
            }
        }
    }

    convert_link(link: string) {
        if (link.includes("youtu")) {
            const youtube_link = link.split(link.includes("?si=") ? "?si=" : "&si=")[0];
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
            return {
                source: "youtube",
                mode: temp.length > 20 ? "playlist" : "track",
                id: temp
            }
        }
        // if link from spotify
        else if (link.includes("spot")) {
            let spotify_link = link.split(link.includes("?si=") ? "?si=" : "&si=")[0];
            const mode = spotify_link.includes("playlist") ? "playlist" : spotify_link.includes("track") ? "track" : "album"
            spotify_link = spotify_link.split(`${mode}/`)[1]
            return {
                source: "spotify",
                mode: mode,
                id: spotify_link
            }
        }
        else {
            return {
                source: "other",
                mode: "",
                id: "This is not a valid link"
            };
        }
    }

    donwloading(title: string, id: string, metadata: { artist: string, year: string, thumbnail: string }): Promise<any> {
        return new Promise(async (resolve, reject) => {
            const __dirname = this.download_folder,
                outputFileName = `${title}.${this.audio_format}`,
                outputPath = path.resolve(__dirname, outputFileName), { artist, year, thumbnail } = metadata;

            let tempThumbnailPath: string | null = null;

            try {
                this.set_status(`Preparing for`, title)
                console.log(`Fetching info for videos ${title}`);
                const data = this.youtube.getdata("tracks", id);

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
                        this.youtube.writedata("tracks", id, data);
                    }
                }
                else {
                    download_url = await this.getAudioURLAlternative(id)
                    data.music_url = download_url;
                    this.youtube.writedata("tracks", id, data);
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
                    writeFileSync(tempThumbnailPath, thumbnailBuffer);
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
                        if (tempThumbnailPath && existsSync(tempThumbnailPath)) {
                            try {
                                unlinkSync(tempThumbnailPath)
                            }
                            catch (e) {
                                console.error('Error during emergency cleanup:', e)
                            }
                        }
                        resolve("ok");
                    })
                    .on('error', async (err) => {
                        throw new Error(err.message, { cause: err.cause });
                    })
                    .save(outputPath);
            } catch (error) {
                console.log(error)
                if (tempThumbnailPath && existsSync(tempThumbnailPath)) {
                    try {
                        unlinkSync(tempThumbnailPath)
                    }
                    catch (e) {
                        console.error('Error during emergency cleanup:', e)
                    }
                }
                reject("not oke");
            }
        })
    }

    converting(...args: string[]): Promise<any> {
        return new Promise(async (resolve) => {
            const [name, input, output] = args;
            const inputFile = `${this.download_folder}/${name}.${input}`;
            const outputFile = `${this.download_folder}/${name}.${output}`;

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
        mkdirSync(`${this.download_folder}`, { recursive: true })

        while (this.queue.length > 0) {
            const downloader = this.queue.shift() as Download_item,
                { title, id, metadata } = downloader,
                formats = [Audio_format.m4a, Audio_format.mp3],
                file_name = `${this.download_folder}\\${title}`;

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

                const track: Track[] = await this.youtube.fetch_track([id[0]]);
                const data = await this.findMatchingVideo(track[0], id);
                if (data) {
                    this.queue.push({
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
        return new Promise(async (resolve) => {
            if (this.youtube_player === null || this.youtube_player === undefined) {
                this.youtube_player = await Innertube.create({ client_type: ClientType.TV });
            }
            try {
                const info = await this.youtube_player.getBasicInfo(id);
                let audioUrl: string = "";
                while (audioUrl.length < 1) {
                    const format = info.chooseFormat({ type: 'audio', quality: 'best' });
                    if (format) {
                        audioUrl = await format.decipher(this.youtube_player.session.player) ?? "";
                    }
                    else {
                        audioUrl = "";
                    }
                }
                resolve(audioUrl)
            } catch (error) {
                throw new Error(error)
            }
        })
    }

    /**
     * @param trackToMatch 
     * @param ids_dont_have 
     * must be youtube ids
     */
    async findMatchingVideo(trackToMatch: Track, ids_dont_have: string[] = []): Promise<Track | null> {
        const trackId = trackToMatch.track?.id || "";
        const trackName = trackToMatch.track?.name || "";
        const artistName = (trackToMatch.artists as any)[0].name || "";
        const trackDuration: number = trackToMatch.track?.duration as number; // in ms
        let database: any;

        if (ids_dont_have.length === 0 && trackToMatch.type.includes("spot")) {
            database = this.spotify.getdata(trackId);
            console.log(database.matched)
            if (database && database.matched) {
                const data = await this.youtube.fetch_track([database.matched]);
                return data[0];
            }
        }

        if (!trackName || !artistName) {
            throw new Error("Track name or artist is missing.");
        }

        const searchQuery = `${trackName} ${artistName}`;

        try {
            let searchResults = (await this.youtube.search(searchQuery)).tracks as Track[];

            const ids: string[] = searchResults.map((track: Track) => {
                return track.track?.id || ""
            }).filter((item: string) => {
                return !ids_dont_have.includes(item) && item !== ""
            })

            const contentRating = await this.youtube.fetch_contentRating(ids);

            const result_track = searchResults.map((item: Track) => {
                return {
                    type: "youtube:track",
                    thumbnail: item.thumbnail,
                    artists: item.artists,
                    track: {
                        name: item.track?.name,
                        id: item.track?.id,
                        duration: item.track?.duration, // in miliseconds
                        releaseDate: item.track?.releaseDate,
                        contentRating: contentRating[item.track?.id as any]
                    },
                }
            })

            if (!searchResults || searchResults.length === 0) {
                return null;
            }

            let bestMatch: Track | null = null;
            let bestScore = -1;

            // 10 seconds
            const DURATION_TOLERANCE_MS = 60 * 1000;

            for (const ytVideo of result_track) {
                const durationDifference = Math.abs(ytVideo.track.duration as number - trackDuration);

                // ignore the video which has difference duration out 20 seconds
                if (durationDifference > DURATION_TOLERANCE_MS) {
                    continue;
                }

                // ignore the Age restricted video
                if (ytVideo.track.contentRating?.ytRating === "ytAgeRestricted") {
                    continue;
                }

                let score = 0;
                const videoTitle: string = ytVideo.track?.name?.toLowerCase() as string;
                const channelTitle = (ytVideo.artists as any)[0]?.name.toLowerCase();
                const lowerCaseArtistName = artistName.toLowerCase();

                // Score based on title keywords and channel name
                if (videoTitle.includes(trackName.toLowerCase())) score += 2;
                if (channelTitle.includes(lowerCaseArtistName)) score += 3; // Strong indicator
                else if (videoTitle.includes(lowerCaseArtistName)) score += 1;

                if (videoTitle.includes("official audio") || videoTitle.includes("art track")) score += 5;
                else if (videoTitle.includes("official video") || videoTitle.includes("official music video")) score += 3;
                else if (videoTitle.includes("lyrics")) score += 2;

                // Add score based on duration proximity
                if (durationDifference < DURATION_TOLERANCE_MS) {
                    score += (5 * (1 - (durationDifference / DURATION_TOLERANCE_MS)));
                }

                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = ytVideo as any;
                }
            }

            if (trackToMatch.type.includes("spot")) {
                if (trackName == "Dear") {
                    console.log("lmao ", {
                        thumbnail: trackToMatch.thumbnail,
                        artists: trackToMatch.artists,
                        music_url: database || null,
                        matched: bestMatch?.track?.id,
                        name: trackToMatch.track?.name,
                        duration: trackToMatch.track?.duration,
                        releaseDate: trackToMatch.track?.releaseDate
                    })
                }
                database = {
                    thumbnail: trackToMatch.thumbnail,
                    artists: trackToMatch.artists,
                    music_url: database || null,
                    matched: bestMatch?.track?.id,
                    name: trackToMatch.track?.name,
                    duration: trackToMatch.track?.duration,
                    releaseDate: trackToMatch.track?.releaseDate
                }
                this.spotify.writedata(trackId, database);
            }

            return bestMatch ?? null;
        }
        catch (e) {
            throw new Error(e);
        }
    }
}