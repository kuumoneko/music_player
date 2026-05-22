import EventEmitter from "node:events";
import { writeLogs, getUserData, writeUserData } from "../db";
import { SleepMode } from "../../shared/types.ts";

const YT_API_BASE = "https://www.youtube.com/youtubei/v1";

interface YTFormat {
    url?: string;
    bitrate?: number;
    audioChannels?: number;
    width?: number;
    cipher?: string;
    signatureCipher?: string;
}

interface YTStreamingData {
    formats?: YTFormat[];
    adaptiveFormats?: YTFormat[];
}

interface MPVResponse {
    request_id?: number;
    error?: string;
    data?: any;
    event?: string;
    name?: string;
}

class DirectYT {
    private visitorData = "";
    private signatureTimestamp: number;
    private ready = false;
    private persisted = false;

    constructor() {
        this.signatureTimestamp = getUserData("ytSignatureTimestamp") ?? 20584;
    }

    async ensureSession() {
        if (this.ready) return;
        try {
            const res = await fetch(`${YT_API_BASE}/config?prettyPrint=false`, {
                method: "POST",
                body: JSON.stringify({
                    context: { client: { clientName: "WEB", clientVersion: "2.20260515.01.00", hl: "en", gl: "US" } },
                }),
                headers: { "Content-Type": "application/json" },
            });
            const data = await res.json();
            this.visitorData = data?.responseContext?.visitorData || "";
            const fetched = data?.responseContext?.signatureTimestamp;
            if (fetched) {
                this.signatureTimestamp = fetched;
                if (!this.persisted) {
                    writeUserData("ytSignatureTimestamp", fetched);
                    this.persisted = true;
                }
            }
            this.ready = true;
        } catch (e) {
            writeLogs([{ type: "error", message: `DirectYT session failed: ${e.message}` }]);
        }
    }

    async resolve(videoId: string): Promise<string | null> {
        try {
            await this.ensureSession();
            if (!this.visitorData) return null;

            const result = await this.resolveOnce(videoId);
            if (result) return result;

            this.ready = false;
            await this.ensureSession();
            return this.resolveOnce(videoId);
        } catch (e) {
            writeLogs([{ type: "error", message: `DirectYT resolve failed: ${e.message}` }]);
            return null;
        }
    }

    private async resolveOnce(videoId: string): Promise<string | null> {
        const res = await fetch(`${YT_API_BASE}/player?prettyPrint=false&alt=json`, {
            method: "POST",
            body: JSON.stringify({
                videoId,
                racyCheckOk: true,
                contentCheckOk: true,
                playbackContext: {
                    contentPlaybackContext: {
                        vis: 0,
                        splay: false,
                        lactMilliseconds: "-1",
                        signatureTimestamp: this.signatureTimestamp,
                    },
                },
                context: {
                    client: {
                        hl: "en",
                        gl: "US",
                        visitorData: this.visitorData,
                        clientName: "ANDROID_VR",
                        clientVersion: "0.1",
                        osName: "Android",
                        osVersion: "14",
                        platform: "MOBILE",
                    },
                    user: { enableSafetyMode: false, lockedSafetyMode: false },
                    request: { useSsl: true, internalExperimentFlags: [] },
                },
            }),
            headers: { "Content-Type": "application/json" },
        });
        const data = await res.json();
        const sd = data?.streamingData as YTStreamingData | undefined;
        if (!sd) return null;

        const all = [...(sd.formats || []), ...(sd.adaptiveFormats || [])];
        const best = all
            .filter((f: YTFormat) => (f.audioChannels ?? 0) > 0 && !f.width)
            .sort((a: YTFormat, b: YTFormat) => (b.bitrate ?? 0) - (a.bitrate ?? 0))[0];
        if (!best) return null;

        if (best.url) return best.url;
        const cipher = best.cipher || best.signatureCipher;
        if (cipher) {
            const p = new URLSearchParams(cipher);
            const baseUrl = p.get("url");
            const sp = p.get("sp") || "signature";
            const sig = p.get("s");
            if (baseUrl && sig) return `${baseUrl}&${sp}=${sig}`;
        }
        return null;
    }
}

export default class Play extends EventEmitter {
    private mpv: Bun.Subprocess;
    private socket: Bun.Socket;
    private pipePath = "\\\\.\\pipe\\kuumo-ipc";
    private appPath: string;
    private sleep: SleepMode = SleepMode.no;
    private timer: NodeJS.Timeout;
    private isFirstLoad: boolean = true;
    public isReady: boolean = false;
    private isRepeat: boolean = false;
    private directYT = new DirectYT();
    private playlistOriginalUrls: string[] = [];
    private playlistIndex: number = 0;

    constructor(appPath: string) {
        super()
        this.appPath = appPath;
        this.sleep = SleepMode.no;
        this.init();
    }

    init() {
        Bun.spawnSync([
            `${this.appPath}/mpv.exe`,
            "--register"
        ]);
        this.mpv = Bun.spawn([
            `${this.appPath}/mpv.exe`,
            "--idle",
            `--input-ipc-server=${this.pipePath}`,
            "--no-video",
            "--ao=wasapi",
            "--media-controls=yes",
            "--force-window=no",
            "--cache-pause=no",
            "--demuxer-readahead-secs=20",
            "--profile=low-latency",
            "--ytdl=no",
        ]);

        setTimeout(async () => {
            this.socket = await Bun.connect({
                unix: this.pipePath,
                socket: {
                    open: () => {
                        this.isReady = true;
                    },
                    data: (_socket: Bun.Socket, data: Buffer) => {
                        const lines = data.toString().split("\n");
                        for (const line of lines) {
                            if (!line.trim()) continue;
                            try {
                                const response = JSON.parse(line) as MPVResponse;
                                if (response.request_id === 999 && response.error === "success") {
                                    const mpvQueue = response.data;

                                    const result = [];
                                    result.push({
                                        filename: this.playlistOriginalUrls[this.playlistIndex]
                                    })

                                    result.push(
                                        ...this.playlistOriginalUrls
                                            .slice(
                                                this.playlistIndex + 1,
                                                Math.max(
                                                    this.playlistOriginalUrls.length - 1,
                                                    this.playlistIndex + mpvQueue.length))
                                            .map(item => {
                                                return {
                                                    filename: item
                                                }
                                            }))
                                    this.emit("queue", result)
                                }

                                if (response.request_id === 888 && response.error === "success") {
                                    this.emit("change-playState", { time: response.data });
                                }

                                if (response.event === "property-change") {
                                    if (response.name === "duration") {
                                        const duration = response.data;
                                        this.emit("duration-update", duration);
                                    }

                                    if (response.name === "pause") {
                                        this.emit("change-playState", { isPlaying: !response.data })
                                    }
                                    if (response.name === "path") {
                                        const original = this.playlistOriginalUrls[this.playlistIndex];
                                        this.emit("playing", original || response.data)
                                    }
                                }

                                if (response.event === "start-file") {
                                    this.emit("loading", true);
                                }

                                if (response.event === "file-loaded") {
                                    this.emit("loading", false);
                                    if (this.isFirstLoad) {
                                        this.isFirstLoad = false;
                                        this.send(["set_property", "pause", true]);
                                        this.send(["seek", 0, "absolute"]);
                                    }
                                    else {
                                        this.send(["set_property", "pause", false]);
                                    }
                                }

                                if (response.name === "duration") {
                                    const duration = response.data || 0;

                                    if (duration === 0) {
                                        this.emit("is-live", true);
                                    } else {
                                        this.emit("is-live", false);
                                    }
                                }
                                if (response.event === "playback-restart" && this.isRepeat) {
                                    this.emit("change-playState", { time: 0 });
                                }
                                if (response.event === "end-file") {
                                    if (!this.isRepeat) {
                                        this.playlistIndex = Math.min(this.playlistIndex + 1, this.playlistOriginalUrls.length - 1);
                                    }
                                    if (this.sleep === SleepMode.eot) {
                                        this.destroy();
                                        this.emit("exit");
                                    }
                                    this.emit("ended");
                                }
                            } catch (e) { writeLogs([{ type: "error", message: e.message }]) }
                        }
                    },
                    error: (_socket: Bun.Socket, error: Error) => {
                        console.error("IPC Socket Error:", error);
                    }
                }
            });
            this.send(["observe_property", 2, "duration"]);
            this.send(["observe_property", 1, "pause"]);
            this.send(["observe_property", 1, "path"]);

            setInterval(() => {
                this.send(["get_property", "time-pos"], 888);
            }, 1000);

        }, 200);
    }

    private send(command: (string | number | boolean | Object)[], id: number = 0) {
        const realCmd: { request_id?: number; command?: (string | number | boolean | Object)[] } = {}
        if (id > 0) {
            realCmd.request_id = id;
        }
        realCmd.command = command
        if (this.socket && typeof this.socket.write === "function") {
            const msg = JSON.stringify(realCmd) + "\n";
            this.socket.write(msg);
        }
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

    async play(urlOrPath: string, title?: string, thumbnail?: string) {
        this.playlistOriginalUrls = [urlOrPath];
        this.playlistIndex = 0;
        const videoId = this.isYouTubeUrl(urlOrPath);
        if (videoId) {
            const directUrl = await this.directYT.resolve(videoId);
            if (directUrl) {
                urlOrPath = directUrl;
            }
        }

        this.send(["stop"]);
        this.send(["playlist-clear"]);
        this.send(["loadfile", urlOrPath, "replace", "-1", {
            "force-media-title": title ?? "",
            "external-file": thumbnail ?? ""
        }]);
    }

    getQueue() {
        this.send(["get_property", "playlist"], 999)
    }

    setRepeat(isRepeat: boolean) {
        this.isRepeat = isRepeat;
        this.send(["set_property", "loop-file", isRepeat ? "inf" : "no"])
    }

    async addTracks(datas: { url: string, title: string, thumbnail: string }[]) {
        for (const data of datas) {
            this.playlistOriginalUrls.push(data.url);
            const videoId = this.isYouTubeUrl(data.url);
            let resolved = data.url;
            if (videoId) {
                const directUrl = await this.directYT.resolve(videoId);
                if (directUrl) {
                    resolved = directUrl;
                }
            }
            this.send(["loadfile", resolved, "append", "-1", {
                "force-media-title": data.title ?? "",
                "external-file": data.thumbnail ?? ""
            }]);
        }
    }

    next() {
        this.send(["playlist-next"])
    }

    previous() {
        this.playlistIndex = Math.max(this.playlistIndex - 2, 0);
        this.send(["playlist-prev"])
    }

    togglePlayPause(isPlay: boolean) {
        this.send(["set_property", "pause", !isPlay]);
    }

    seekTo(seconds: number) {
        this.send(["seek", seconds, "absolute"]);
    }

    setVolume(value: number) {
        this.send(["set_property", "volume", value]);
    }

    setSleep(sleep: SleepMode) {
        this.sleep = sleep;
        if (sleep === SleepMode.no) {
            if (this.timer) clearTimeout(this.timer);
        }
        else if (sleep === SleepMode.eot) {

        }
        else if (sleep.includes("hours")) {
            const time = Number(sleep.split("after ")[1].split(" hours")[0]);
            this.timer = setTimeout(() => {
                this.emit("exit")
            }, time * 60 * 60 * 1000);
        }
        else {
            const time = Number(sleep.split("after ")[1].split(" minutes")[0]);
            this.timer = setTimeout(() => {
                this.emit("exit")
            }, time * 60 * 1000);
        }
    }

    public async destroy() {
        console.log("Cleaning up Kuumo Player...");
        if (this.socket) {
            this.send(["quit"]);
            this.socket.end();
        }

        setTimeout(() => {
            if (this.mpv && this.mpv.exitCode === null) {
                this.mpv.kill();
            }
        }, 100);
    }
}