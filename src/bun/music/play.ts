import EventEmitter from "node:events";
import { dlopen, read, CString } from "bun:ffi";
import { writeLogs, getUserData } from "../db";

import { SleepMode } from "../../shared/types.ts";
import { resolve } from "node:path";
import { INNERTUBE_USER_AGENT } from "../../shared/constants.ts";

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
    private appPath: string;
    private sleep: SleepMode = SleepMode.no;
    private timer: NodeJS.Timeout | undefined;
    private eventTimer: NodeJS.Timeout | undefined;
    private timePosTimer: NodeJS.Timeout | undefined;
    public isReady: boolean = false;
    private isFirstLoad: boolean = true;
    private isRepeat: boolean = false;
    private isPlaying: boolean = false;
    public resolveYoutubeUrl?: (videoId: string) => Promise<{ url: string | null; error?: string } | null>;
    private playlistUrls: string[] = [];
    private playlistIndex: number = 0;
    private loadedUrl: string = "";
    private isLiveStream: boolean = false;
    private fadeTimer: NodeJS.Timeout | null = null;

    constructor(appPath: string) {
        super();
        this.appPath = appPath;
        this.sleep = SleepMode.no;
    }

    initialize() {
        this.init();
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
                ["keepaspect", "no"],
                ["referrer", "https://www.youtube.com/"],
                ["user-agent", INNERTUBE_USER_AGENT],
            ];
            for (const [k, v] of opts) {
                const r = this.symbols.mpv_set_option_string(this.handle, S(k), S(v));
                if (r < 0) writeLogs([{ type: "error", message: `mpv_set_option(${k}) failed: ${this.mpvError(r)}` }]);
            }

            const initErr = this.symbols.mpv_initialize(this.handle);
            if (initErr < 0) throw new Error(`mpv_initialize: ${this.mpvError(initErr)}`);

            this.setVolume(0);

            this.symbols.mpv_observe_property(this.handle, BigInt(1), S("duration"), MPV_FORMAT_DOUBLE);
            this.symbols.mpv_observe_property(this.handle, BigInt(2), S("pause"), MPV_FORMAT_FLAG);
            this.symbols.mpv_observe_property(this.handle, BigInt(3), S("path"), MPV_FORMAT_STRING);
            this.symbols.mpv_observe_property(this.handle, BigInt(4), S("stream-live"), MPV_FORMAT_FLAG);

            this.startEventLoop();
            this.startTimePolling();

            this.isReady = true;
            this.emit("ready");
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            writeLogs([{ type: "error", message: `Libmpv init failed: ${message}` }]);
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
            } catch (e) {
                const message = e instanceof Error ? e.message : String(e);
                writeLogs([{ type: "error", message: `Time polling failed: ${message}` }]);
            }
        }, 250);
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
                this.handleEndFile(data);
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
            } else {
                this.emit("is-live", true);
            }
        } else if (name === "pause" && format === MPV_FORMAT_FLAG) {
            const isPaused = read.i32(dataPtr, 0);
            this.isPlaying = !isPaused;
            this.updateSMTC(this.isPlaying);
            this.emit("change-playState", { isPlaying: this.isPlaying });
        } else if (name === "stream-live" && format === MPV_FORMAT_FLAG) {
            const isLive = read.i32(dataPtr, 0);
            if (isLive) this.emit("is-live", true);
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
            if (this.isLiveStream) {
                const savedVolume = getUserData("volume") ?? 50;
                this.setVolume(savedVolume);
                this.command("set", "pause", "no");
            } else {
                this.command("set", "pause", "yes");
                this.command("seek", "0", "absolute");
                const savedVolume = getUserData("volume") ?? 50;
                this.setVolume(savedVolume);
            }
        } else {
            const savedVolume = getUserData("volume") ?? 50;
            this.symbols?.mpv_set_property_string(this.handle, S("volume"), S("0"));
            this.command("set", "pause", "no");
            this.emit("change-playState", { isPlaying: true });
            setTimeout(() => this.fadeVolume(0, savedVolume, 450), 50);
        }
        setTimeout(() => this.emitDuration(), 500);
    }

    private emitDuration() {
        if (!this.symbols) return;
        try {
            const durPtr: Pointer = this.symbols.mpv_get_property_string(this.handle, S("duration"));
            const livePtr: Pointer = this.symbols.mpv_get_property_string(this.handle, S("stream-live"));
            let isLive = false;
            if (livePtr && livePtr !== 0) {
                isLive = new CString(livePtr).toString() === "yes";
                this.symbols.mpv_free(livePtr);
            }
            if (durPtr && durPtr !== 0) {
                const duration = parseFloat(new CString(durPtr).toString());
                this.symbols.mpv_free(durPtr);
                if (isLive || this.isLiveStream) {
                    this.emit("is-live", true);
                    return;
                }
                if (!isNaN(duration) && duration > 0.5) {
                    this.emit("duration-update", duration);
                    this.emit("is-live", false);
                    this.updateSMTC();
                }
            } else if (isLive || this.isLiveStream) {
                this.emit("is-live", true);
            }
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            writeLogs([{ type: "error", message: `Duration emit failed: ${message}` }]);
        }
    }

    private handleEndFile(data: Pointer) {
        let reason = -1;
        let errorCode = 0;
        if (data && data !== 0) {
            reason = read.i32(data, 0);
            errorCode = read.i32(data, 4);
        }
        writeLogs([{ type: "info", message: `mpv end-file: reason=${reason} errorCode=${errorCode}` }]);
        if (reason === 4) {
            writeLogs([{ type: "error", message: `mpv file load error: ${this.mpvError(errorCode)}` }]);
        }
        if (!this.isRepeat) {
            this.playlistIndex = Math.min(this.playlistIndex + 1, this.playlistUrls.length - 1);
        }
        if (this.sleep === SleepMode.eot) {
            this.sleep = SleepMode.no;
            this.isPlaying = false;
            this.isRepeat = false;
            this.playlistUrls = [];
            this.playlistIndex = 0;
            this.command("stop");
            this.emit("change-playState", { isPlaying: false, time: 0 });
            return;
        }
        if (!this.isRepeat && this.playlistIndex >= this.playlistUrls.length - 1) {
            this.isPlaying = false;
            this.loadedUrl = "";
            this.emit("change-playState", { isPlaying: false, time: 0 });
            this.emit("ended");
        }
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
        if (!this.symbols || !this.handle) {
            writeLogs([{ type: "error", message: `play: mpv not initialized, cannot play ${urlOrPath}` }]);
            this.emit("track-error", _title || urlOrPath);
            return;
        }
        this.playlistUrls = [urlOrPath];
        this.playlistIndex = 0;
        this.isLiveStream = false;
        const videoId = this.isYouTubeUrl(urlOrPath);
        if (videoId) {
            const result = await this.resolveYoutubeUrl?.(videoId);
            const directUrl = result?.url ?? null;
            if (directUrl) {
                urlOrPath = directUrl;
                this.isLiveStream = urlOrPath.includes(".m3u8") || urlOrPath.includes("/manifest/");
                writeLogs([{ type: "info", message: `play: resolved ${videoId} to ${this.isLiveStream ? "HLS/manifest" : "audio"} URL` }]);
            } else {
                const reason = result?.error || "This video is unavailable";
                const botHint = /bot/i.test(reason) ? " - paste your YouTube cookies in Settings" : "";
                writeLogs([{ type: "error", message: `play: resolveUrl returned null for ${videoId}: ${reason}` }]);
                this.emit("track-error", { id: videoId, error: `${reason}${botHint}` });
                this.emit("loading", false);
                return;
            }
        }
        writeLogs([{ type: "info", message: `play: urlOrPath = "${urlOrPath}"` }]);
        if (!videoId) {
            const exists = await Bun.file(urlOrPath).exists();
            if (!exists) {
                writeLogs([{ type: "error", message: `File not found: ${urlOrPath}` }]);
                this.emit("track-error", _title || urlOrPath);
                return;
            }
        }
        this.command("stop");
        const escaped = urlOrPath.replace(/\\/g, "/");
        writeLogs([{ type: "info", message: `play: loadfile "${escaped}" replace` }]);
        const loadCmd = `loadfile "${escaped}" replace`;
        const ret = this.symbols!.mpv_command_string(this.handle, S(loadCmd));
        if (ret < 0) writeLogs([{ type: "error", message: `mpv loadfile failed: ${this.mpvError(ret)}` }]);
        const savedVolume = getUserData("volume") ?? 50;
        this.setVolume(savedVolume);
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
        const resolved: { url: string; original: string }[] = [];
        await Promise.all(
            datas.map(async (data) => {
                const videoId = this.isYouTubeUrl(data.url);
                if (videoId) {
                    const result = await this.resolveYoutubeUrl?.(videoId);
                    if (result?.url) {
                        resolved.push({ url: result.url, original: data.url });
                        return;
                    }
                    const reason = result?.error || "unavailable";
                    writeLogs([{ type: "error", message: `addTracks: failed to resolve ${videoId} (${reason}), skipping` }]);
                    return;
                }
                resolved.push({ url: data.url, original: data.url });
            })
        );
        this.playlistUrls.push(...resolved.map(r => r.original));
        for (const { url } of resolved) {
            const ret = this.symbols?.mpv_command_string(this.handle, S(`loadfile "${url.replace(/\\/g, "/")}" append`));
            if (ret !== undefined && ret < 0) writeLogs([{ type: "error", message: `mpv loadfile append failed: ${this.mpvError(ret)}` }]);
        }
        this.updateSMTC();
    }

    async next() {
        if (this.fadeTimer) {
            clearTimeout(this.fadeTimer);
            this.fadeTimer = null;
        }
        const strPtr = this.symbols?.mpv_get_property_string(this.handle, S("volume"));
        const currentVolume = strPtr ? parseInt(new CString(strPtr).toString()) || 0 : 0;
        if (strPtr) this.symbols?.mpv_free(strPtr);
        await this.fadeVolume(currentVolume, 0, 450);
        this.symbols?.mpv_command_string(this.handle, S("playlist-next"));
    }

    async previous() {
        if (this.fadeTimer) {
            clearTimeout(this.fadeTimer);
            this.fadeTimer = null;
        }
        const strPtr = this.symbols?.mpv_get_property_string(this.handle, S("volume"));
        const currentVolume = strPtr ? parseInt(new CString(strPtr).toString()) || 0 : 0;
        if (strPtr) this.symbols?.mpv_free(strPtr);
        await this.fadeVolume(currentVolume, 0, 450);
        if (this.playlistIndex <= 0) {
            this.seekTo(0);
            const savedVolume = getUserData("volume") ?? 50;
            setTimeout(() => this.fadeVolume(0, savedVolume, 450), 50);
        } else {
            this.playlistIndex = this.playlistIndex - 2;
            this.symbols?.mpv_command_string(this.handle, S("playlist-prev"));
        }
    }

    async togglePlayPause(isPlay: boolean) {
        if (this.fadeTimer) {
            clearTimeout(this.fadeTimer);
            this.fadeTimer = null;
        }
        try {
            if (isPlay) {
                const savedVolume = getUserData("volume") ?? 50;
                this.symbols?.mpv_set_property_string(this.handle, S("volume"), S("0"));
                this.symbols?.mpv_set_property_string(this.handle, S("pause"), S("no"));
                this.isPlaying = true;
                this.emit("change-playState", { isPlaying: true });
                this.updateSMTC(true);
                await this.fadeVolume(0, savedVolume, 500);
            } else {
                const strPtr = this.symbols?.mpv_get_property_string(this.handle, S("volume"));
                const currentVolume = strPtr ? parseInt(new CString(strPtr).toString()) || 0 : 0;
                if (strPtr) this.symbols?.mpv_free(strPtr);
                this.symbols?.mpv_set_property_string(this.handle, S("pause"), S("yes"));
                this.isPlaying = false;
                this.emit("change-playState", { isPlaying: false });
                this.updateSMTC(false);
                await this.fadeVolume(currentVolume, 0, 500);
                const savedVolume = getUserData("volume") ?? 50;
                this.symbols?.mpv_set_property_string(this.handle, S("volume"), S(String(savedVolume)));
            }
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            writeLogs([{ type: "error", message: `togglePlayPause error: ${message}` }]);
            this.isPlaying = false;
            this.emit("change-playState", { isPlaying: false });
        }
    }

    seekTo(seconds: number) {
        this.command("seek", String(seconds), "absolute");
    }

    private fadeVolume(from: number, to: number, duration: number): Promise<void> {
        return new Promise(resolve => {
            const start = performance.now();
            const step = () => {
                if (!this.fadeTimer) {
                    resolve();
                    return;
                }
                const elapsed = performance.now() - start;
                const progress = Math.min(elapsed / duration, 1);
                const eased = 1 - Math.pow(1 - progress, 3);
                const current = Math.round(from + (to - from) * eased);
                this.symbols?.mpv_set_property_string(this.handle, S("volume"), S(String(current)));
                if (progress < 1) {
                    this.fadeTimer = setTimeout(step, 16);
                } else {
                    this.fadeTimer = null;
                    resolve();
                }
            };
            this.fadeTimer = setTimeout(step, 16);
        });
    }

    setVolume(value: number) {
        if (this.fadeTimer) {
            clearTimeout(this.fadeTimer);
            this.fadeTimer = null;
        }
        this.symbols?.mpv_set_property_string(this.handle, S("volume"), S(String(value)));
    }

    setEqualizer(bands: { freq: number; gain: number }[]) {
        if (!this.symbols) {
            writeLogs([{ type: "error", message: "setEqualizer: symbols not ready" }]);
            return;
        }
        if (!bands || bands.length === 0) {
            const ret = this.symbols.mpv_set_property_string(this.handle, S("af"), S(""));
            writeLogs([{
                type: "info",
                message: `setEqualizer: cleared rc=${ret}`,
            }]);
            return;
        }
        const valid = bands.filter(b => Number.isFinite(b.freq) && Number.isFinite(b.gain));
        if (valid.length === 0) {
            const ret = this.symbols.mpv_set_property_string(this.handle, S("af"), S(""));
            writeLogs([{
                type: "info",
                message: `setEqualizer: cleared rc=${ret}`,
            }]);
            return;
        }
        const graph = valid
            .map(b => `equalizer=f=${b.freq}:t=q:w=1:g=${b.gain}`)
            .join(",");
        const val = graph;
        const ret = this.symbols.mpv_set_property_string(this.handle, S("af"), S(val));
        writeLogs([{
            type: ret < 0 ? "error" : "info",
            message: `setEqualizer: rc=${ret} bands=${bands.length} val=${val.slice(0, 120)}`,
        }]);
    }

    setSleep(sleep: SleepMode) {
        this.sleep = sleep;
        if (this.timer) clearTimeout(this.timer);
        if (sleep === SleepMode.no) {
        } else if (sleep === SleepMode.eot) {
        } else if (sleep === SleepMode.hour) {
            this.timer = setTimeout(() => {
                this.emit("exit");
            }, 1 * 60 * 60 * 1000);
        } else {
            const time = Number(sleep.split("after ")[1]?.split(" minutes")[0]);
            if (isNaN(time) || time <= 0) return;
            this.timer = setTimeout(() => {
                this.emit("exit");
            }, time * 60 * 1000);
        }
    }

    public updateSMTC(isPlaying?: boolean) {
        try {
            const current = getUserData("currentPlaying");
            if (!current?.title) return;
            let playing = isPlaying;
            if (playing === undefined) {
                const strPtr = this.symbols?.mpv_get_property_string(this.handle, S("pause"));
                if (strPtr && strPtr !== 0) {
                    const paused = new CString(strPtr).toString();
                    this.symbols?.mpv_free(strPtr);
                    playing = paused !== "yes";
                }
            }
            this.emit("smtc-update", {
                title: current.title,
                artist: current.artist,
                thumbnail: current.thumbnail,
                isList: this.playlistUrls.length > 1,
                isPlaying: playing ?? false,
            });
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            writeLogs([{ type: "error", message: `SMTC update failed: ${message}` }]);
        }
    }

    public async destroy() {
        this.isReady = false;
        if (this.eventTimer) clearTimeout(this.eventTimer);
        if (this.timePosTimer) clearInterval(this.timePosTimer);
        if (this.timer) clearTimeout(this.timer);
        if (this.fadeTimer) {
            clearTimeout(this.fadeTimer);
            this.fadeTimer = null;
        }
        if (this.handle) {
            this.symbols?.mpv_terminate_destroy(this.handle);
        }
    }
}
