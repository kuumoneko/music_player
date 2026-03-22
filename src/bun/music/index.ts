// import Spotify from "./spotify.ts";
import Youtube from "./youtube.ts";
import { Download_item, Status, Track } from "../../shared/types.ts";
import { mkdirSync, readdirSync, unlinkSync } from "node:fs";
import path, { basename, extname, resolve } from "node:path";
import { Local } from "./local.ts";
import areStringsSimilar from "../lib/comapre_string.ts";
import { spawn } from "node:child_process";
import { getDataFromDatabase } from "../lib/database.ts";

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

export default class Player {
    public youtube: Youtube;
    // public spotify: Spotify;
    public local: Local;
    public download_folder: string = "";
    public status: { data: string, track: string } = { data: Status.idle, track: "" };
    public download_queue: Download_item[] = [];
    public audio_format: string = Audio_format.m4a;
    public folder: string = "";

    constructor(
        userPath: string, appPath: string,
    ) {
        // this.spotify
        this.youtube = new Youtube(appPath, userPath);

        getDataFromDatabase(userPath, 'data', 'profile').then(({ folder }) => {
            this.download_folder = folder ?? resolve(appPath, "data", "download");
        });
        this.local = new Local(resolve(userPath, "data"), appPath);
        this.folder = appPath;
    }

    format_title(title: string): string {
        const emojiAndSymbolPattern =
            /[\u2600-\u27FF\u2B00-\u2BFF\u2300-\u23FF\u{1F000}-\u{1FFFF}\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F900}-\u{1F9FF}]/gu;
        const regionalIndicatorPattern = /[\u{1F1E6}-\u{1F1FF}]{2}/gu;
        const invalidCharsPattern = /[\x7C\x2F\x3F\x3A\x2A\x3C\x3E]/gu;
        const multipleSpacesPattern = /\s+/g;
        const trimSpacesPattern = /\s+$/g;
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

    converting(...args: string[]): Promise<any> {
        return new Promise(async (resolve) => {
            const [name, input, output] = args;

            const process = spawn(`${this.folder}\\bin\\ffmpeg.exe`, ["-i", `"${this.download_folder}\\${name}.${input}"`, "-c:a", "aac", "-o", `"${this.download_folder}\\${name}.${output}"`], { shell: true });
            process.stdout.on('data', (data) => {
                console.log(`stdout: ${data}`);
            });
            process.stderr.on('data', (data) => {
                console.error(`stderr: ${data}`);
            });

            process.on("close", (code: number) => {
                if (code === 0) {
                    resolve("ok")
                }
                else {
                    resolve(code)
                }
            })
        })
    }

    async download_track(data: { id: string, title: string, metadata: { artist: string, year: string, thumbnail: string }, option: string[] }) {
        return new Promise((resolve, _reject) => {
            const { title, option } = data;
            this.status = {
                data: Status.prepare, track: title
            }
            console.log(title, option)
            const process = spawn(`${path.resolve(this.folder, "bin", "yt-dlp.exe")}`, option, { shell: true });

            process.stdout.on("data", (data) => {
                const text = data.toString();
                const lines = text.split("\n");

                lines.forEach((line: string) => {
                    if (line.includes("[download]") && line.includes("%")) {
                        const percentMatch = line.match(/(\d+\.\d+)%/);

                        if (percentMatch && percentMatch[1]) {
                            const percentage = percentMatch[1];

                            console.log(`Progress: ${percentage}%`);
                            this.status = {
                                data: Status.downloading, track: `${percentage}%`
                            }
                        }
                    }
                });
            });

            process.stderr.on('data', (data) => {
                console.error(`stderr: ${data}`);
            })

            process.on("close", (code: number) => {
                if (code === 0) {
                    this.status = {
                        data: Status.done, track: title
                    }
                    resolve(code)
                }
                else {
                    resolve(code)
                }
            })
        })
    }

    async download() {
        mkdirSync(`${this.download_folder}`, { recursive: true });

        const downloade_data = [];
        const defaultDownloadOptions = [
            "-x",
            "--ffmpeg-location",
            `${resolve(this.folder, "bin", "ffmpeg.exe")}`,
            "--audio-format",
            "m4a",
            "--audio-quality",
            "0",
            "--embed-thumbnail",
            "--add-metadata",
            "--newline",
            "--console-title",
            "-P",
            `${this.download_folder}`,
            "--js-runtimes",
            "node",
        ]
        for (const item of this.download_queue) {
            let temp = item;
            // if (item.id.length > 20) {
            //     const track = await this.spotify.fetch_track([item.id[0]]);
            //     const Ytb_track = await this.findMatchingVideo(track[0]);
            //     if (Ytb_track?.id) {
            //         temp.id[0] = Ytb_track.id as string;
            //     }
            //     else {
            //         console.error("")
            //     }
            // }
            temp.title = this.format_title(temp.title);
            const metadata = []
            for (const [key, value] of Object.entries(item.metadata)) {
                if (key === "source" || key === "thumbnail") { continue }
                metadata.push('--parse-metadata', `"${value}":%(${key})s`);
            }

            downloade_data.push({
                ...temp,
                option: [
                    ...defaultDownloadOptions,
                    "-o", `"${temp.title}.%(ext)s"`,
                    '--add-metadata',
                    ...metadata,
                    `https://www.youtube.com/watch?v=${temp.id[0]}`,
                ]
            });
        }

        for (const data of downloade_data) {
            // check if the track is downloaded but in other extesion, just use this.converting()
            const existingFiles = readdirSync(this.download_folder);
            const matchingFile = existingFiles.find(file => {
                const name = basename(file, extname(file));
                return areStringsSimilar(name, data.title);
            });

            if (matchingFile) {
                const currentExt = extname(matchingFile).replace(".", "");
                if (currentExt !== "m4a" && Object.values(Audio_format).includes(currentExt as Audio_format)) {
                    await this.converting(data.title, currentExt, "m4a");
                    try {
                        unlinkSync(path.join(this.download_folder, matchingFile));
                    } catch (e) {
                        console.error(e);
                    }
                    continue;
                } else if (currentExt === "m4a") {
                    continue;
                }
            }

            await this.download_track(data);
        }

    }

    async findMatchingVideo(trackToMatch: Track, ids_dont_have: string[] = []): Promise<Track | null> {
        // const trackId = trackToMatch.id ?? "";
        const trackName = trackToMatch.name ?? "";
        const artistName = (trackToMatch.artist as any)[0].name ?? "";
        const trackDuration: number = trackToMatch.duration as number ?? 0; // in ms
        // let database: any;

        // if (ids_dont_have.length === 0 && trackToMatch.source.includes("spot")) {
        //     database = this.spotify.getdata("tracks", [trackId]);
        //     if (database && database.matched) {
        //         const data = await this.youtube.fetch_track([database.matched]);
        //         return data[0];
        //     }
        // }

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

            // if (trackToMatch.source.includes("spot")) {
            //     database = {
            //         thumbnail: trackToMatch.thumbnail,
            //         artist: trackToMatch.artist,
            //         music_url: database.music_url ?? null,
            //         matched: bestMatch?.id,
            //         name: trackToMatch.name,
            //         duration: trackToMatch.duration,
            //         releasedDate: trackToMatch.releasedDate,
            //         id: trackId
            //     }
            //     this.spotify.writedata("tracks", [trackId], [database]);
            // }

            return bestMatch ?? null;
        }
        catch (e) {
            console.error(e)
            return null
        }
    }
}