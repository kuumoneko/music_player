import Youtube from "./youtube";
import { DownloadItem, Status } from "../../shared/types.ts";
import path, { basename, extname, resolve } from "node:path";
import { Local } from "./local.ts";
import areStringsSimilar from "../utils/compareString.ts";
import { getSystemData, writeLogs } from "../db/index.ts";
import Play from "./play.ts";
import { mkdir } from "node:fs/promises";
import { unlinkSync } from "node:fs";
import FFmpeg from "../ffmpeg/index.ts";
import { YoutubeResolver } from "./youtube-resolver.ts";
import { YoutubeDataAPI } from "./youtube-data-api/index.ts";
import { GoogleAuth } from "../auth/google.ts";
import { decryptCredential, isEncrypted } from "../lib/crypto.ts";
import { ensurePopulated } from "../lib/hash.ts";

export enum AudioFormat {
    aac = "aac",
    alac = "alac",
    flac = "flac",
    m4a = "m4a",
    mp3 = "mp3",
    opus = "opus",
    vorbis = "vorbis",
    wav = "wav"
}

const DOWNLOAD_CHUNK_SIZE = 8 * 1024 * 1024;

async function downloadConcurrent(url: string, outputPath: string, contentLength: number): Promise<void> {
    const writer = Bun.file(outputPath).writer();
    try {
        for (let start = 0; start < contentLength; start += DOWNLOAD_CHUNK_SIZE) {
            const end = Math.min(start + DOWNLOAD_CHUNK_SIZE - 1, contentLength - 1);
            const res = await fetch(url, {
                headers: { Range: `bytes=${start}-${end}` },
            });
            writer.write(new Uint8Array(await res.arrayBuffer()));
            writer.flush();
        }
    } finally {
        await writer.end();
    }
}

async function downloadThumbnail(url: string): Promise<string> {
    const res = await fetch(url);
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);

    let ext = "jpeg";
    if (bytes[0] === 0x89 && bytes[1] === 0x50) ext = "png";
    else if (bytes[0] === 0x47 && bytes[1] === 0x49) ext = "gif";
    else if (bytes[0] === 0x52 && bytes[1] === 0x49) ext = "webp";

    const b64 = Buffer.from(bytes).toString("base64");
    return `data:image/${ext};base64,${b64}`;
}

export default class Player {
    public youtube: Youtube | undefined;
    public local: Local | undefined;
    public player: Play | undefined;
    public downloadFolder: string = "";
    public status: { data: string, track: string } = { data: Status.idle, track: "" };
    public onStatusChange?: (status: { data: string; track: string }) => void;
    public downloadQueue: DownloadItem[] = [];
    public audioFormat: string = AudioFormat.m4a;
    public folder: string = "";
    public userPath: string = "";
    public googleAuth: GoogleAuth;
    public youtubeDataAPI: YoutubeDataAPI;
    private ffmpeg: FFmpeg;
    private youtubeResolver: YoutubeResolver;

    constructor(userPath: string, appPath: string, downloadFolder: string) {
        this.folder = appPath;
        this.userPath = userPath;
        this.downloadFolder = downloadFolder;
        this.ffmpeg = new FFmpeg(appPath);
        this.youtubeResolver = new YoutubeResolver();
        this.googleAuth = new GoogleAuth();
        this.youtubeDataAPI = new YoutubeDataAPI(this.googleAuth);
    }

    async init() {
        this.player = new Play(this.folder)
        const { youtubeApiKeys } = getSystemData();
        const storedKeys = youtubeApiKeys ?? [];
        const plainKeys: string[] = [];
        for (const k of storedKeys) {
            if (isEncrypted(k)) {
                const plain = await decryptCredential(k);
                if (plain) {
                    plainKeys.push(plain);
                    continue;
                }
                writeLogs([{ type: "error", message: "Failed to decrypt a stored API key" }]);
            }
            plainKeys.push(k);
        }
        this.youtube = new Youtube();
        this.youtubeDataAPI.setYoutube(this.youtube);
        this.youtubeDataAPI.updateApiKeys(plainKeys);
        this.player.resolveYoutubeUrl = (videoId) => this.youtube?.resolveStreamUrl(videoId) ?? Promise.resolve({ url: null, error: "Resolver unavailable" });
        await this.googleAuth.init();
        const { isLocal } = getSystemData();
        if (isLocal) {
            this.local = new Local(resolve(this.userPath, "data"), this.folder);
        }
        return isLocal;
    }

    initMpv() {
        this.player?.initialize();
    }

    formatTitle(title: string): string {
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
        writeLogs([{ type: "info", message: "Checking download folder before downloading" }]);

        const glob = new Bun.Glob("*");
        const files = await Array.fromAsync(
            glob.scan({ cwd: this.downloadFolder, onlyFiles: true })
        );

        const deleteTasks: Promise<void>[] = [];

        for (const file of files) {
            const ext = extname(file);
            const filename = basename(file, ext);

            const isNeeded = this.downloadQueue.some((item) => {
                return areStringsSimilar(item.title, filename);
            });

            if (!isNeeded) {
                const filePath = path.join(this.downloadFolder, file);
                const task = Bun.file(filePath).delete()
                    .then(() => {
                        writeLogs([{ type: "info", message: `Delete unused file: ${filename}` }]);
                    })
                    .catch((e) => {
                        const message = e instanceof Error ? e.message : String(e);
                        writeLogs([{ type: "error", message: `Failed to delete unused file ${filename}: ${message}` }]);
                    });

                deleteTasks.push(task);
            }
        }

        if (deleteTasks.length > 0) {
            await Promise.all(deleteTasks);
        }

        writeLogs([{ type: "info", message: "Done check download folder before downloading!" }]);
    }

    async converting(name: string, input: string, output: string): Promise<boolean> {
        const inputPath = path.join(this.downloadFolder, `${name}.${input}`);
        const outputPath = path.join(this.downloadFolder, `${name}.${output}`);

        try {
            await this.ffmpeg.convertAudio(inputPath, outputPath);
            writeLogs([{ type: "info", message: `Successfully converted ${name} to ${output}` }]);
            return true;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            writeLogs([{ type: "error", message: `Conversion failed for ${name}: ${message}` }]);
            return false;
        }
    }

    async downloadTrack(data: { id: string[], title: string, metadata: { artist: string, year: string, thumbnail: string } }) {
        const { title, metadata, id } = data;
        const videoId = id[0];
        writeLogs([{ type: "info", message: `Downloading ${title}...` }]);

        this.status = { data: Status.prepare, track: title };
        this.onStatusChange?.(this.status);

        let rawPath = "";
        try {
            const resolved = await this.youtubeResolver.resolveFull(videoId);
            if (!resolved) throw new Error("Failed to resolve video via InnerTube");

            const safeName = title.replace(/[<>:"/\\|?*]/g, "_").substring(0, 100);
            rawPath = path.join(this.downloadFolder, `${videoId}.raw`);
            const finalPath = path.join(this.downloadFolder, `${safeName}.m4a`);

            if (resolved.contentLength && resolved.contentLength > 0) {
                writeLogs([{ type: "info", message: `Downloading ${title} (${(resolved.contentLength / 1024 / 1024).toFixed(1)} MB)...` }]);
                await downloadConcurrent(resolved.url, rawPath, resolved.contentLength);
            } else {
                writeLogs([{ type: "info", message: `Downloading ${title} (single connection)...` }]);
                const res = await fetch(resolved.url);
                if (!res.body) throw new Error("No response body for download");
                const sink = Bun.file(rawPath).writer();
                try {
                    for await (const chunk of res.body) {
                        sink.write(chunk);
                        sink.flush();
                    }
                } finally {
                    await sink.end();
                }
            }

            writeLogs([{ type: "info", message: `Converting ${title} to M4A...` }]);
            await this.ffmpeg.convertAudio(rawPath, finalPath);

            const thumbDataUri = await downloadThumbnail(resolved.thumbnailUrl);
            const embedMeta: Record<string, string> = {
                title: resolved.title,
                artist: resolved.artist,
            };
            if (metadata.year) embedMeta["date"] = metadata.year;
            await this.ffmpeg.embedMetadata(finalPath, embedMeta, thumbDataUri);

            this.status = { data: Status.done, track: title };
            this.onStatusChange?.(this.status);
            writeLogs([{ type: "info", message: `Done download ${title}!` }]);
            return 0;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            writeLogs([{ type: "error", message: `Failed to download ${title}: ${message}` }]);
            this.status = { data: Status.done, track: title };
            this.onStatusChange?.(this.status);
            return 1;
        } finally {
            if (rawPath) try { unlinkSync(rawPath); } catch { }
        }
    }

    async download() {
        try {
            await mkdir(`${this.downloadFolder}`, { recursive: true });

            const downloadData = [];

            for (const item of this.downloadQueue) {
                const clonedItem = { ...item };
                clonedItem.title = this.formatTitle(clonedItem.title);
                downloadData.push(clonedItem);
            }

            const glob = new Bun.Glob("*");
            const existingFiles = await Array.fromAsync(
                glob.scan({ cwd: this.downloadFolder, onlyFiles: true })
            ).catch(() => []);

            const processData = async (data: DownloadItem) => {
                if (existingFiles.length > 0) {
                    const matchingFile = existingFiles.find(file => {
                        const name = basename(file, extname(file));
                        return areStringsSimilar(name, data.title);
                    });

                    if (matchingFile) {
                        const currentExt = extname(matchingFile).replace(".", "");

                        if (currentExt !== "m4a" && Object.values(AudioFormat).includes(currentExt as AudioFormat)) {
                            writeLogs([{ type: "info", message: `Converting ${data.title} from ${currentExt} to m4a...` }]);
                            await this.converting(data.title, currentExt, "m4a");
                            try {
                                await Bun.file(path.join(this.downloadFolder, matchingFile)).delete();
                            } catch (e) {
                                const message = e instanceof Error ? e.message : String(e);
                                writeLogs([{ type: "error", message }]);
                            }
                            return;
                        } else if (currentExt === "m4a") {
                            writeLogs([{ type: "info", message: `Skipping ${data.title}, already exists.` }]);
                            return;
                        }
                    }
                }

                await this.downloadTrack(data);
            };

            const CONCURRENCY_LIMIT = 4;
            const executing = new Set<Promise<void>>();

            writeLogs([{ type: "info", message: `Starting queue: ${downloadData.length} items...` }]);

            for (const data of downloadData) {
                const task = processData(data)
                    .then(() => {
                        executing.delete(task);
                    })
                    .catch(e => {
                        const message = e instanceof Error ? e.message : String(e);
                        writeLogs([{ type: "error", message: `Error processing ${data.title}: ${message}` }]);
                        executing.delete(task);
                    });

                executing.add(task);

                if (executing.size >= CONCURRENCY_LIMIT) {
                    await Promise.race(executing);
                }
            }

            await Promise.all(executing);
            ensurePopulated();
            writeLogs([{ type: "info", message: "All downloads finished successfully!" }]);
            this.status = { data: Status.done, track: "" };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            writeLogs([{ type: "error", message: `Download failed: ${message}` }]);
            this.status = { data: Status.error, track: message };
        }
        this.onStatusChange?.(this.status);
    }
}
