import EventEmitter from "node:events";
import { dlopen, read, CString } from "bun:ffi";
import { writeLogs, getUserData } from "../db";
import { YoutubeResolver } from "./youtube-resolver.ts";
import { SleepMode } from "../../shared/types.ts";
import { resolve } from "node:path";
import SMTC from "./smtc.ts";

const MPV_EVENT_SHUTDOWN = 1;
const MPV_EVENT_START_FILE = 6;
const MPV_EVENT_END_FILE = 7;
const MPV_EVENT_FILE_LOADED = 8;
const MPV_EVENT_PLAYBACK_RESTART = 11;
const MPV_EVENT_PROPERTY_CHANGE = 22;

const MPV_FORMAT_NONE = 0;
const MPV_FORMAT_STRING = 1;
const MPV_FORMAT_FLAG = 2;
const MPV_FORMAT_DOUBLE = 4;

type Pointer = any;

const S = (s: string) => Buffer.from(s + "\0");

export default class Play extends EventEmitter {
    private handle: Pointer = 0;
    private symbols: any = null;
    private bridge: SMTC = null;
    private bridgeReady: boolean = false;
    private appPath: string;
    private sleep: SleepMode = SleepMode.no;
    private timer: NodeJS.Timeout | undefined;
    private eventTimer: NodeJS.Timeout | undefined;
    private timePosTimer: NodeJS.Timeout | undefined;
    public isReady: boolean = false;
    private isFirstLoad: boolean = true;
    private isRepeat: boolean = false;
    private isPlaying: boolean = false;
    private resolver = new YoutubeResolver();
    private playlistUrls: string[] = [];
    private playlistIndex: number = 0;
    private loadedUrl: string = "";

    constructor(appPath: string) {
        super();
        this.appPath = appPath;
        this.sleep = SleepMode.no;
        this.init();
        this.initSMTC();
    }

    private init() {
        try {
            const lib = dlopen(resolve(this.appPath, "libmpv.dll"), {
                mpv_create: { args: [], returns: "pointer" },
                mpv_initialize: { args: ["pointer"], returns: "int" },
                mpv_set_option_string: { args: ["pointer", "cstring", "cstring"], returns: "int" },
                mpv_command_string: { args: ["pointer", "cstring"], returns: "int" },
                mpv_get_property_string: { args: ["pointer", "cstring"], returns: "pointer" },
                mpv_set_property_string: { args: ["pointer", "cstring", "cstring"], returns: "int" },
                mpv_observe_property: { args: ["pointer", "u64", "cstring", "int"], returns: "int" },
                mpv_wait_event: { args: ["pointer", "double"], returns: "pointer" },
                mpv_terminate_destroy: { args: ["pointer"], returns: "void" },
                mpv_free: { args: ["pointer"], returns: "void" },
                mpv_error_string: { args: ["int"], returns: "pointer" },
                mpv_free_node_contents: { args: ["pointer"], returns: "void" },
            });
            this.symbols = lib.symbols;

            const rawHandle = this.symbols.mpv_create();
            if (!rawHandle || rawHandle === 0) {
                throw new Error("mpv_create returned null");
            }
            this.handle = rawHandle;

            const opts: [string, string][] = [
                ["vo", "null"],
                ["ao", "wasapi"],
                ["cache-pause", "no"],
                ["demuxer-readahead-secs", "20"],
                ["ytdl", "no"],
                ["keepaspect", "no"],
            ];
            for (const [k, v] of opts) {
                const r = this.symbols.mpv_set_option_string(this.handle, S(k), S(v));
                if (r < 0) writeLogs([{ type: "error", message: `mpv_set_option(${k}) failed: ${this.mpvError(r)}` }]);
            }

            const initErr = this.symbols.mpv_initialize(this.handle);
            if (initErr < 0) throw new Error(`mpv_initialize: ${this.mpvError(initErr)}`);

            this.symbols.mpv_observe_property(this.handle, BigInt(1), S("duration"), MPV_FORMAT_DOUBLE);
            this.symbols.mpv_observe_property(this.handle, BigInt(2), S("pause"), MPV_FORMAT_FLAG);
            this.symbols.mpv_observe_property(this.handle, BigInt(3), S("path"), MPV_FORMAT_STRING);

            this.startEventLoop();
            this.startTimePolling();

            this.isReady = true;
            this.emit("ready");
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            writeLogs([{ type: "error", message: `Libmpv init failed: ${message}` }]);
        }
    }

    private initSMTC() {
        try {
            this.bridge = new SMTC(this.appPath);
            this.bridge.on("toggle", () => this.togglePlayPause(!this.isPlaying));
            this.bridge.on("next", () => this.next());
            this.bridge.on("previous", () => this.previous());
            this.bridgeReady = true;
        } catch (e) {
            this.bridgeReady = false;
        }
    }

    private startEventLoop() {
        const poll = () => {
            if (!this.isReady) return;
            try {
                const eventPtr = this.symbols!.mpv_wait_event(this.handle, 0);
                if (eventPtr && eventPtr !== 0) {
                    this.processEvent(eventPtr);
                }
            } catch (e) {
                const message = e instanceof Error ? e.message : String(e);
                writeLogs([{ type: "error", message: `Event loop: ${message}` }]);
            }
            this.eventTimer = setTimeout(poll, 50);
        };
        this.eventTimer = setTimeout(poll, 50);
    }

    private startTimePolling() {
        this.timePosTimer = setInterval(() => {
            if (!this.isReady || !this.symbols) return;
            try {
                const strPtr: Pointer = this.symbols.mpv_get_property_string(this.handle, S("time-pos"));
                if (strPtr && strPtr !== 0) {
                    const time = parseFloat(new CString(strPtr).toString());
                    this.symbols.mpv_free(strPtr);
                    if (!isNaN(time)) {
                        this.emit("change-playState", { time });
                    }
                }
            } catch {
            }
        }, 1000);
    }

    private processEvent(eventPtr: Pointer) {
        const eventId = read.i32(eventPtr, 0);
        const data: Pointer = read.ptr(eventPtr, 16);
        switch (eventId) {
            case MPV_EVENT_PROPERTY_CHANGE:
                if (data) this.handlePropertyChange(data);
                break;
            case MPV_EVENT_START_FILE:
                this.emit("loading", true);
                break;
            case MPV_EVENT_FILE_LOADED:
                this.handleFileLoaded();
                break;
            case MPV_EVENT_END_FILE:
                this.handleEndFile();
                break;
            case MPV_EVENT_PLAYBACK_RESTART:
                if (this.isRepeat) this.emit("change-playState", { time: 0 });
                break;
            case MPV_EVENT_SHUTDOWN:
                this.isReady = false;
                break;
        }
    }

    private handlePropertyChange(propPtr: Pointer) {
        if (!propPtr) return;
        const namePtr: Pointer = read.ptr(propPtr, 0);
        if (!namePtr) return;
        const name = new CString(namePtr).toString();
        const format = read.i32(propPtr, 8);
        if (format === MPV_FORMAT_NONE) return;
        const dataPtr: Pointer = read.ptr(propPtr, 16);
        if (!dataPtr) return;
        if (name === "duration" && format === MPV_FORMAT_DOUBLE) {
            const duration = read.f64(dataPtr, 0);
            if (duration > 0.5) {
                this.emit("duration-update", duration);
                this.emit("is-live", false);
                this.updateSMTC();
            }
        } else if (name === "pause" && format === MPV_FORMAT_FLAG) {
            const isPaused = read.i32(dataPtr, 0);
            this.isPlaying = !isPaused;
            this.updateSMTC(this.isPlaying);
        } else if (name === "path" && format === MPV_FORMAT_STRING) {
            const charPtr: Pointer = read.ptr(dataPtr, 0);
            if (!charPtr) return;
            const path = new CString(charPtr).toString();
            if (path && path !== this.loadedUrl) {
                this.loadedUrl = path;
                const original = this.playlistUrls[this.playlistIndex];
                this.emit("playing", original || path);
                this.emitQueue();
                this.updateSMTC();
            }
        }
    }

    private handleFileLoaded() {
        this.emit("loading", false);
        if (this.isFirstLoad) {
            this.isFirstLoad = false;
            this.command("set", "pause", "yes");
            this.command("seek", "0", "absolute");
        } else {
            this.command("set", "pause", "no");
        }
        setTimeout(() => this.emitDuration(), 500);
    }

    private emitDuration() {
        if (!this.symbols) return;
        try {
            const strPtr: Pointer = this.symbols.mpv_get_property_string(this.handle, S("duration"));
            if (strPtr && strPtr !== 0) {
                const duration = parseFloat(new CString(strPtr).toString());
                this.symbols.mpv_free(strPtr);
                if (!isNaN(duration) && duration > 0.5) {
                    this.emit("duration-update", duration);
                    this.emit("is-live", false);
                    this.updateSMTC();
                }
            }
        } catch { }
    }

    private handleEndFile() {
        if (!this.isRepeat) {
            this.playlistIndex = Math.min(this.playlistIndex + 1, this.playlistUrls.length - 1);
        }
        if (this.sleep === SleepMode.eot) {
            this.destroy();
            this.emit("exit");
            return;
        }
        this.emit("ended");
    }

    private command(...args: string[]) {
        if (!this.symbols) return;
        const cmd = args.join(" ");
        this.symbols.mpv_command_string(this.handle, S(cmd));
    }

    private mpvError(code: number): string {
        if (!this.symbols) return String(code);
        const strPtr: Pointer = this.symbols.mpv_error_string(code);
        if (strPtr && strPtr !== 0) {
            return new CString(strPtr).toString();
        }
        return String(code);
    }

    private isYouTubeUrl(url: string): string | null {
        try {
            const parsed = new URL(url);
            const isYT = parsed.hostname.includes("youtube.com") || parsed.hostname.includes("youtu.be");
            if (!isYT) return null;
            return parsed.searchParams.get("v") || parsed.pathname.split("/").pop() || null;
        } catch {
            return null;
        }
    }

    async play(urlOrPath: string, _title?: string, _thumbnail?: string) {
        this.playlistUrls = [urlOrPath];
        this.playlistIndex = 0;
        const videoId = this.isYouTubeUrl(urlOrPath);
        if (videoId) {
            const directUrl = await this.resolver.resolveUrl(videoId);
            if (directUrl) {
                urlOrPath = directUrl;
            }
        }
        this.command("stop");
        const loadCmd = `loadfile "${urlOrPath.replace(/\\/g, "/")}" replace`;
        this.symbols!.mpv_command_string(this.handle, S(loadCmd));
        this.updateSMTC();
    }

    getQueue() {
        this.emitQueue();
    }

    private emitQueue() {
        const result: { filename: string }[] = [];
        result.push({ filename: this.playlistUrls[this.playlistIndex] || "" });
        for (let i = this.playlistIndex + 1; i < this.playlistUrls.length; i++) {
            result.push({ filename: this.playlistUrls[i] });
        }
        this.emit("queue", result);
    }

    setRepeat(isRepeat: boolean) {
        this.isRepeat = isRepeat;
        this.symbols?.mpv_set_property_string(this.handle, S("loop-file"), S(isRepeat ? "inf" : "no"));
    }

    async addTracks(datas: { url: string; title: string; thumbnail: string }[]) {
        const snapshot = datas.map(d => d.url);
        this.playlistUrls.push(...snapshot);
        const tempPlaylist: string[] = Array(datas.length);
        await Promise.all(
            datas.map(async (data, i) => {
                const videoId = this.isYouTubeUrl(data.url);
                const resolvedUrl = videoId
                    ? (await this.resolver.resolveUrl(videoId)) ?? data.url
                    : data.url;
                tempPlaylist[i] = resolvedUrl;
            })
        );
        for (const url of tempPlaylist) {
            this.symbols?.mpv_command_string(this.handle, S(`loadfile "${url}" append`));
        }
        this.updateSMTC();
    }

    next() {
        this.symbols?.mpv_command_string(this.handle, S("playlist-next"));
    }

    previous() {
        this.playlistIndex = Math.max(this.playlistIndex - 2, 0);
        this.symbols?.mpv_command_string(this.handle, S(`playlist-prev`));
    }

    togglePlayPause(isPlay: boolean) {
        this.isPlaying = isPlay;
        this.symbols?.mpv_set_property_string(this.handle, S("pause"), S(isPlay ? "no" : "yes"));
        this.updateSMTC(isPlay);
        this.emit("change-playState", { isPlaying: isPlay });
    }

    seekTo(seconds: number) {
        this.command("seek", String(seconds), "absolute");
    }

    setVolume(value: number) {
        this.symbols?.mpv_set_property_string(this.handle, S("volume"), S(String(value)));
    }

    setSleep(sleep: SleepMode) {
        this.sleep = sleep;
        if (sleep === SleepMode.no) {
            if (this.timer) clearTimeout(this.timer);
        } else if (sleep === SleepMode.eot) {
        } else if (sleep.includes("hours")) {
            const time = Number(sleep.split("after ")[1].split(" hours")[0]);
            this.timer = setTimeout(() => {
                this.emit("exit");
            }, time * 60 * 60 * 1000);
        } else {
            const time = Number(sleep.split("after ")[1].split(" minutes")[0]);
            this.timer = setTimeout(() => {
                this.emit("exit");
            }, time * 60 * 1000);
        }
    }

    public updateSMTC(isPlaying?: boolean) {
        if (!this.bridgeReady) return;
        try {
            const current = getUserData("currentPlaying");
            if (!current?.title) return;
            this.bridge.updateMetadata(current.title, current.artist, current.thumbnail, this.playlistUrls.length > 1)
            if (isPlaying === undefined) {
                const strPtr = this.symbols?.mpv_get_property_string(this.handle, S("pause"));
                if (strPtr && strPtr !== 0) {
                    const paused = new CString(strPtr).toString();
                    this.symbols?.mpv_free(strPtr);
                    isPlaying = paused !== "yes";
                }
            }
            this.bridge.setPlaybackState(isPlaying)
        } catch { }
    }

    public async destroy() {
        this.isReady = false;
        if (this.eventTimer) clearTimeout(this.eventTimer);
        if (this.timePosTimer) clearInterval(this.timePosTimer);
        if (this.timer) clearTimeout(this.timer);
        if (this.handle) {
            this.symbols?.mpv_terminate_destroy(this.handle);
        }
    }
}
