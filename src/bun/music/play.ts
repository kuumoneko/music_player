import EventEmitter from "node:events";
import { writeLogs } from "../db";
import { SleepMode } from "../../shared/types.ts";

const YT_API_BASE = "https://www.youtube.com/youtubei/v1";

class DirectYT {
    private visitorData = "";
    private signatureTimestamp = 20584;
    private ready = false;

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
            this.signatureTimestamp = data?.responseContext?.signatureTimestamp || 20584;
            this.ready = true;
        } catch (e) {
            writeLogs([{ type: "error", message: `DirectYT session failed: ${e.message}` }]);
        }
    }

    async resolve(videoId: string): Promise<string | null> {
        try {
            await this.ensureSession();
            if (!this.visitorData) return null;

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
            const sd = data?.streamingData;
            if (!sd) return null;

            const all = [...(sd.formats || []), ...(sd.adaptiveFormats || [])];
            const best = all
                .filter((f: any) => f.audioChannels > 0 && !f.width)
                .sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0))[0];
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
        } catch (e) {
            writeLogs([{ type: "error", message: `DirectYT resolve failed: ${e.message}` }]);
            return null;
        }
    }
}

export default class Play extends EventEmitter {
    private mpv: any;
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
                    data: (_socket: any, data: any) => {
                        const lines = data.toString().split("\n");
                        for (const line of lines) {
                            if (!line.trim()) continue;
                            try {
                                const response = JSON.parse(line);
                                if (response.request_id === 999 && response.error === "success") {
                                    const mpvQueue = response.data;
                                    mpvQueue[0].filename = this.playlistOriginalUrls[this.playlistIndex]
                                    this.emit("queue", mpvQueue)
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
                    error: (_socket: any, error: any) => {
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
        let realCmd: any = {}
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

    async play(urlOrPath: string) {
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
        this.send(["loadfile", urlOrPath, "replace"]);
    }

    getQueue() {
        this.send(["get_property", "playlist"], 999)
    }

    setRepeat(isRepeat: boolean) {
        this.isRepeat = isRepeat;
        this.send(["set_property", "loop-file", isRepeat ? "inf" : "no"])
    }

    async addTracks(urls: string[]) {
        for (const url of urls) {
            this.playlistOriginalUrls.push(url);
            const videoId = this.isYouTubeUrl(url);
            let resolved = url;
            if (videoId) {
                const directUrl = await this.directYT.resolve(videoId);
                if (directUrl) {
                    resolved = directUrl;
                }
            }
            this.send(["loadfile", resolved, "append"]);
        }
    }

    setVideoMetadata(thumbnailUrl: string, title: string) {
        this.send(["video-add", thumbnailUrl, "auto"]);

        this.send(["set_property", "metadata/by-key/title", title]);
    }

    next() {
        this.playlistIndex = Math.min(this.playlistIndex + 1, this.playlistOriginalUrls.length - 1);
        this.send(["playlist-next"])
    }

    previous() {
        this.playlistIndex = Math.max(this.playlistIndex - 1, 0);
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