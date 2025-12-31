import Innertube, { ClientType } from "youtubei.js";
import ffmpeg from "fluent-ffmpeg";
import Spotify from "./spotify.ts";
import Youtube from "./youtube.ts";
import { Download_item, Status, Track } from "../types/index.ts";
import { existsSync, mkdirSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, extname, resolve as pathResolve, resolve } from "node:path";
import { Local } from "./local.ts";
import areStringsSimilar from "../lib/comapre_string.ts";

export enum Audio_format {
    aac = "aac",
    alac = "alac",
    flac = "flac",
    m4a = "m4a",
    mp3 = "mp3",
    opus = "opus",
    vorbis = "vorbis",
    wav = "wav"
}
const client_types = [ClientType.ANDROID, ClientType.IOS, ClientType.WEB, ClientType.TV, ClientType.TV_EMBEDDED];

export default class Player {
    public spotify: Spotify;
    public youtube: Youtube;
    public local: Local;
    private youtube_player: Innertube | null = null;
    public download_folder: string = "";
    public status: { data: string, track: string } = { data: Status.idle, track: "" };
    public download_queue: Download_item[] = [];
    public audio_format: string = Audio_format.m4a;
    public folder: string = "";

    constructor(options: {
        youtube_api_keys: { ApiKey: string, isReached: boolean }[],
        spotify_api_keys: { ApiKey: string, ClientId: string, isReached: boolean, RetryAfter: number }[],
        path: string,
        download_folder: string,
        bin: string
    }) {
        this.spotify = new Spotify({
            spotify_api_keys: options.spotify_api_keys,
            path: options.path + "\\data\\spotify"
        });
        this.youtube = new Youtube({
            api_keys: options.youtube_api_keys,
            path: options.path + "\\data\\youtube"
        });
        this.local = new Local(options.path + "\\data\\local", options.bin);
        this.download_folder = options.download_folder ?? "";
        this.folder = options.path;
        ffmpeg.setFfmpegPath(resolve(options.bin, "ffmpeg.exe"))
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
                continue;
            }
            const ext = extname(file.name)
            const filename = basename(file.name, ext);

            const checked = this.download_queue.filter((item) => {
                return areStringsSimilar(item.title, filename)
            });
            if (checked.length === 0) {
                try {
                    unlinkSync(`${this.download_folder}\\${filename}${ext}`);
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
            const __dirname = this.download_folder,
                outputFileName = `${title}.${this.audio_format}`,
                outputPath = pathResolve(__dirname, outputFileName), { artist, year, thumbnail } = metadata;

            let tempThumbnailPath: string | null = null;

            try {
                this.status = {
                    data: Status.prepare, track: title
                }
                console.log(`Fetching info for videos ${title}`);
                const data = (this.youtube.get_data("tracks", [id]))[0];

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
                        this.youtube.write_data("tracks", [id], [data]);
                    }
                }
                else {
                    download_url = await this.getAudioURLAlternative(id)
                    data.music_url = download_url;
                    this.youtube.write_data("tracks", [id], [data]);
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
                    const contentType = response.headers.get('content-type') || 'image/jpeg'; // Default to jpeg
                    let ext = '.jpg';
                    if (contentType.includes('png')) {
                        ext = '.png';
                    } else if (contentType.includes('jpeg')) {
                        ext = '.jpeg';
                    }

                    tempThumbnailPath = pathResolve(__dirname, `temp_thumbnail_123${ext}`);
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
                        this.status = {
                            data: Status.downloading, track: title
                        }

                    })
                    .on('progress', (progress) => {
                        console.log(`Processing: ${progress.percent} %`);
                        this.status = {
                            data: Status.downloading, track: `${progress.percent?.toFixed(2)} % `
                        }
                    })
                    .on('end', async () => {
                        console.log(`\nDownload and metadata embedding finished for "${title}". Saved to: ${outputPath}`);
                        this.status = {
                            data: Status.done, track: title
                        }

                        if (tempThumbnailPath && existsSync(tempThumbnailPath)) {
                            try {
                                unlinkSync(tempThumbnailPath)
                            } catch (error) {
                                console.error('Error during emergency cleanup:', error)
                            }
                        }
                        resolve("ok");
                    })
                    .on('error', async (err) => {
                        throw new Error(err.message);
                    })
                    .save(outputPath);
            } catch (error) {
                console.log(error)
                if (tempThumbnailPath && existsSync(tempThumbnailPath)) {
                    try {
                        unlinkSync(tempThumbnailPath)
                    } catch (error) {
                        console.error('Error during emergency cleanup:', error)
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

        while (this.download_queue.length > 0) {
            const downloader = this.download_queue.shift() as Download_item,
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
            let downloaded_id = id[id.length - 1];
            if (downloaded_id.length === 22) {
                const track = await this.spotify.fetch_track([downloaded_id]);
                const temp = await this.findMatchingVideo(track[0]);
                if (temp) {
                    downloaded_id = temp.id as string;
                }
            }
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
                    this.download_queue.push({
                        title: this.format_title(data.name as string) ?? "",
                        id: [...id, data.id ?? ''],
                        metadata: {
                            artist: (data.artist as any)[0].name ?? "",
                            year: data.releasedDate ?? "",
                            thumbnail: data.thumbnail ?? "",
                            source: source
                        }
                    })
                }
            }
        }
        this.status = {
            data: Status.idle, track: ""
        }
        await this.sleep(5000).then(() => {
            this.status = {
                data: Status.idle, track: ""
            }
        })
    }

    getAudioURLAlternative(id: string): Promise<string> {
        return new Promise(async (resolve) => {
            let url = "";
            const maxRetry = 5;
            let retryCount = 0;
            while (url === "") {
                if (this.youtube_player === null || this.youtube_player === undefined) {
                    this.youtube_player = await Innertube.create({
                        client_type: client_types[retryCount],
                        generate_session_locally: true,
                        enable_session_cache: true
                    });
                }
                try {
                    const info = await this.youtube_player.getBasicInfo(id);
                    const format = info.chooseFormat({ type: 'audio', quality: 'best' });
                    if (format) {
                        const temp = await format.decipher();
                        if (temp && temp.length > 0) {
                            url = temp;
                        }
                    }
                    else {
                        url = "";
                        this.youtube_player = null as unknown as Innertube;
                        console.error("no format found")
                        retryCount++;
                    }
                }
                catch (e: any) {
                    url = "";
                    this.youtube_player = null as unknown as Innertube;
                    if (e.reason) {
                        console.log(e)
                    }
                    console.error("bug here", e);
                    retryCount++;
                }
                if (retryCount >= maxRetry) {
                    throw new Error("Max retry reached")
                }
            }
            resolve(url)
        })
    }

    async findMatchingVideo(trackToMatch: Track, ids_dont_have: string[] = []): Promise<Track | null> {
        const trackId = trackToMatch.id ?? "";
        const trackName = trackToMatch.name ?? "";
        const artistName = (trackToMatch.artist as any)[0].name ?? "";
        const trackDuration: number = trackToMatch.duration as number ?? 0; // in ms
        let database: any;

        if (ids_dont_have.length === 0 && trackToMatch.source.includes("spot")) {
            database = this.spotify.getdata("tracks", [trackId]);
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
            let searchResults = (await this.youtube.search(searchQuery, "video")).tracks as Track[];
            const ids: string[] = searchResults.map((track: Track) => {
                return track.id || ""
            }).filter((item: string) => {
                return !ids_dont_have.includes(item) && item !== ""
            })

            const contentRating = await this.youtube.fetch_contentRating(ids);

            const result_track = searchResults.map((item: Track) => {
                return {
                    type: "youtube:track",
                    thumbnail: item.thumbnail,
                    artists: item.artist,
                    name: item.name,
                    id: item.id,
                    duration: item.duration, // in miliseconds
                    releaseDate: item.releasedDate,
                    contentRating: contentRating[item.id as any]
                }
            })

            if (!searchResults || searchResults.length === 0) {
                return null;
            }

            let bestMatch: Track | null = null;
            let bestScore = -1;

            // 60 seconds
            const DURATION_TOLERANCE_MS = 60 * 1000;

            for (const ytVideo of result_track) {
                const durationDifference = Math.abs(ytVideo.duration as number - trackDuration);

                // ignore the video which has difference duration out 20 seconds
                if (durationDifference > DURATION_TOLERANCE_MS) {
                    continue;
                }

                // ignore the Age restricted video
                if (ytVideo.contentRating?.ytRating === "ytAgeRestricted") {
                    continue;
                }

                let score = 0;
                const videoTitle: string = ytVideo.name?.toLowerCase() as string;
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

            if (trackToMatch.source.includes("spot")) {
                database = {
                    thumbnail: trackToMatch.thumbnail,
                    artist: trackToMatch.artist,
                    music_url: database.music_url ?? null,
                    matched: bestMatch?.id,
                    name: trackToMatch.name,
                    duration: trackToMatch.duration,
                    releasedDate: trackToMatch.releasedDate,
                    id: trackId
                }
                this.spotify.writedata("tracks", [trackId], [database]);
            }

            return bestMatch ?? null;
        }
        catch (e) {
            console.error(e)
            return null
        }
    }
}