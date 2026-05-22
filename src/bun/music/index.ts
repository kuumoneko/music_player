import Youtube from "./youtube.ts";
import { Download_item, Status, System } from "../../shared/types.ts";
import path, { basename, extname, resolve } from "node:path";
import { Local } from "./local.ts";
import areStringsSimilar from "../utils/compare_string.ts";
import { getDataFromDatabase } from "../lib/database.ts";
import { writeLogs } from "../db/index.ts";
import Play from "./play.ts";
import { mkdir } from "node:fs/promises";

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
    public local: Local;
    public player: Play;
    public download_folder: string = "";
    public status: { data: string, track: string } = { data: Status.idle, track: "" };
    public onStatusChange?: (status: { data: string; track: string }) => void;
    public download_queue: Download_item[] = [];
    public audio_format: string = Audio_format.m4a;
    public folder: string = "";
    public userPath: string = "";

    constructor(userPath: string, appPath: string, folder: string) {
        this.folder = appPath;
        this.userPath = userPath;
        this.download_folder = folder;
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
                    .catch(() => { });

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

        const proc = Bun.spawn([
            `${this.folder}\\ffmpeg.exe`,
            "-y",
            "-loglevel", "error",
            "-threads", "0",
            "-i", inputPath,
            "-c:a", "aac",
            outputPath
        ], {
            stdout: "ignore",
            stderr: "inherit"
        });

        const exitCode = await proc.exited;

        if (exitCode === 0) {
            writeLogs([{ type: "info", message: `Successfully converted ${name} to ${output}` }]);
            return "ok";
        }

        writeLogs([{ type: "error", message: `Conversion failed for ${name}. Exit code: ${exitCode}` }]);
        return exitCode;
    }

    async download_track(data: { id: string, title: string, metadata: { artist: string, year: string, thumbnail: string }, option: string[] }) {
        const { title, option } = data;
        writeLogs([{ type: "info", message: `Downloading ${title}...` }]);

        this.status = {
            data: Status.prepare, track: title
        };
        this.onStatusChange?.(this.status);

        const command = [`${path.resolve(this.folder, "yt-dlp.exe")}`, ...option];

        const proc = Bun.spawn(command, {
            stdout: "pipe",
            stderr: "inherit"
        });

        if (proc.stdout) {
            const reader = proc.stdout.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const text = decoder.decode(value);
                const lines = text.split("\n");

                for (const line of lines) {
                    if (line.includes("[download]") && line.includes("%")) {
                        const percentMatch = line.match(/(\d+\.\d+)%/);

                        if (percentMatch && percentMatch[1]) {
                            const percentage = percentMatch[1];

                            console.log(`Progress [${title}]: ${percentage}%`);

                            this.status = {
                                data: Status.downloading, track: `${percentage}%`
                            };
                            this.onStatusChange?.(this.status);
                        }
                    }
                }
            }
        }

        const exitCode = await proc.exited;

        if (exitCode === 0) {
            this.status = { data: Status.done, track: title };
            this.onStatusChange?.(this.status);
            writeLogs([{ type: "info", message: `Done download ${title}!` }]);
        } else {
            writeLogs([{ type: "error", message: `Failed to download ${title} (Exit code: ${exitCode})` }]);
        }

        return exitCode;
    }

    async download() {
        await mkdir(`${this.download_folder}`, { recursive: true });

        const download_data = [];
        const defaultDownloadOptions = [
            "-x",
            "--ffmpeg-location",
            `${resolve(this.folder, "ffmpeg.exe")}`,
            "--js-runtimes", `bun:/bun.exe`,
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
        ];

        for (const item of this.download_queue) {
            let temp = item;
            temp.title = this.format_title(temp.title);
            const metadata = []

            for (const [key, value] of Object.entries(item.metadata)) {
                if (key === "source" || key === "thumbnail") { continue; }
                metadata.push('--parse-metadata', `"${value}":%(${key})s`);
            }

            download_data.push({
                ...temp,
                option: [
                    ...defaultDownloadOptions,
                    "-o", `${temp.title}.%(ext)s`,
                    '--add-metadata',
                    ...metadata,
                    `https://www.youtube.com/watch?v=${temp.id[0]}`,
                ]
            });
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
        console.log("---------------------- FINISH DOWNLOADING ----------------------")
    }
}