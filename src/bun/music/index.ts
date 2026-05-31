import Youtube from "./youtube.ts";
import { Download_item, Status, System } from "../../shared/types.ts";
import path, { basename, extname, resolve } from "node:path";
import { Local } from "./local.ts";
import areStringsSimilar from "../utils/compare_string.ts";
import { getDataFromDatabase } from "../lib/database.ts";
import { writeLogs } from "../db/index.ts";
import Play from "./play.ts";
import { mkdir, writeFile } from "node:fs/promises";
import { unlinkSync } from "node:fs";
import FFmpeg from "../ffmpeg/index.ts";
import { YoutubeResolver } from "./youtube-resolver.ts";

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

async function fetchChunk(url: string, start: number, end: number): Promise<{ data: ArrayBuffer; index: number }> {
    const res = await fetch(url, {
        headers: { Range: `bytes=${start}-${end}` },
    });
    return { data: await res.arrayBuffer(), index: start };
}

async function downloadConcurrent(url: string, outputPath: string, contentLength: number, concurrency = 8): Promise<void> {
    const chunkSize = Math.ceil(contentLength / concurrency);
    const chunks: { data: ArrayBuffer; index: number }[] = [];

    const chunkPromises = Array.from({ length: concurrency }, async (_, i) => {
        const start = i * chunkSize;
        const end = Math.min((i + 1) * chunkSize - 1, contentLength - 1);
        if (start > contentLength) return;
        const chunk = await fetchChunk(url, start, end);
        chunks.push(chunk);
    });

    await Promise.all(chunkPromises);
    chunks.sort((a, b) => a.index - b.index);

    const totalSize = chunks.reduce((sum, c) => sum + c.data.byteLength, 0);
    const merged = new Uint8Array(totalSize);
    let offset = 0;
    for (const chunk of chunks) {
        merged.set(new Uint8Array(chunk.data), offset);
        offset += chunk.data.byteLength;
    }
    await writeFile(outputPath, merged);
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
    public youtube: Youtube;
    public local: Local;
    public player: Play;
    public download_folder: string = "";
    public status: { data: string, track: string } = { data: Status.idle, track: "" };
    public onStatusChange?: (status: { data: string; track: string }) => void;
    public download_queue: Download_item[] = [];
    public audio_format: string = Audio_format.m4a;
    public folder: string = "";
    public userPath: string = "";
    private ffmpeg: FFmpeg;
    private youtubeResolver: YoutubeResolver;

    constructor(userPath: string, appPath: string, folder: string) {
        this.folder = appPath;
        this.userPath = userPath;
        this.download_folder = folder;
        this.ffmpeg = new FFmpeg(appPath);
        this.youtubeResolver = new YoutubeResolver();
    }

    async init() {
        this.player = new Play(this.folder)
        this.youtube = new Youtube();
        const { isLocal } = await getDataFromDatabase(this.folder, "..", "Resources", "app", 'data', 'system') as System;
        if (isLocal) {
            this.local = new Local(resolve(this.userPath, "data"), this.folder);
        }
        return isLocal;
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
        writeLogs([{ type: "info", message: "Checking download folder before downloading" }]);

        const glob = new Bun.Glob("*");
        const files = await Array.fromAsync(
            glob.scan({ cwd: this.download_folder, onlyFiles: true })
        );

        const deleteTasks: Promise<void>[] = [];

        for (const file of files) {
            const ext = extname(file);
            const filename = basename(file, ext);

            const isNeeded = this.download_queue.some((item) => {
                return areStringsSimilar(item.title, filename);
            });

            if (!isNeeded) {
                const filePath = path.join(this.download_folder, file);
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

    async converting(name: string, input: string, output: string): Promise<string | number> {
        const inputPath = path.join(this.download_folder, `${name}.${input}`);
        const outputPath = path.join(this.download_folder, `${name}.${output}`);

        try {
            await this.ffmpeg.convertAudio(inputPath, outputPath);
            writeLogs([{ type: "info", message: `Successfully converted ${name} to ${output}` }]);
            return "ok";
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            writeLogs([{ type: "error", message: `Conversion failed for ${name}: ${message}` }]);
            return 1;
        }
    }

    async download_track(data: { id: string[], title: string, metadata: { artist: string, year: string, thumbnail: string } }) {
        const { title, metadata, id } = data;
        const videoId = id[0];
        writeLogs([{ type: "info", message: `Downloading ${title}...` }]);

        this.status = { data: Status.prepare, track: title };
        this.onStatusChange?.(this.status);

        try {
            const resolved = await this.youtubeResolver.resolveFull(videoId);
            if (!resolved) throw new Error("Failed to resolve video via InnerTube");

            const safeName = title.replace(/[<>:"/\\|?*]/g, "_").substring(0, 100);
            const rawPath = path.join(this.download_folder, `${videoId}.raw`);
            const finalPath = path.join(this.download_folder, `${safeName}.m4a`);

            if (resolved.contentLength && resolved.contentLength > 0) {
                writeLogs([{ type: "info", message: `Downloading ${title} (${(resolved.contentLength / 1024 / 1024).toFixed(1)} MB)...` }]);
                await downloadConcurrent(resolved.url, rawPath, resolved.contentLength);
            } else {
                writeLogs([{ type: "info", message: `Downloading ${title} (single connection)...` }]);
                const res = await fetch(resolved.url);
                const buf = await res.arrayBuffer();
                await writeFile(rawPath, new Uint8Array(buf));
            }

            writeLogs([{ type: "info", message: `Converting ${title} to M4A...` }]);
            await this.ffmpeg.convertAudio(rawPath, finalPath);
            try { unlinkSync(rawPath); } catch { }

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
        }
    }

    async download() {
        await mkdir(`${this.download_folder}`, { recursive: true });

        const download_data = [];

        for (const item of this.download_queue) {
            const temp = { ...item };
            temp.title = this.format_title(temp.title);
            download_data.push(temp);
        }

        const glob = new Bun.Glob("*");
        const existingFiles = await Array.fromAsync(
            glob.scan({ cwd: this.download_folder, onlyFiles: true })
        ).catch(() => []);

        const processData = async (data: any) => {
            if (existingFiles.length > 0) {
                const matchingFile = existingFiles.find(file => {
                    const name = basename(file, extname(file));
                    return areStringsSimilar(name, data.title);
                });

                if (matchingFile) {
                    const currentExt = extname(matchingFile).replace(".", "");

                    if (currentExt !== "m4a" && Object.values(Audio_format).includes(currentExt as Audio_format)) {
                        writeLogs([{ type: "info", message: `Converting ${data.title} from ${currentExt} to m4a...` }]);
                        await this.converting(data.title, currentExt, "m4a");
                        try {
                            await Bun.file(path.join(this.download_folder, matchingFile)).delete();
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

            await this.download_track(data);
        };

        const CONCURRENCY_LIMIT = 4;
        const executing = new Set<Promise<void>>();

        writeLogs([{ type: "info", message: `Starting queue: ${download_data.length} items...` }]);

        for (const data of download_data) {
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
        writeLogs([{ type: "info", message: "All downloads finished successfully!" }]);
    }
}
