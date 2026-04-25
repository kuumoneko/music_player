import EventEmitter from "node:events";
import { writeLogs } from "../db";
import { SleepMode } from "../../shared/types.ts";

export default class Play extends EventEmitter {
    private mpv: any;
    private socket: Bun.Socket;
    private pipePath = "\\\\.\\pipe\\kuumo-ipc";
    private appPath: string;
    private sleep: SleepMode = SleepMode.no;
    private timer: NodeJS.Timeout;
    private isFirstLoad: boolean = true;
    public isReady: boolean = false;

    constructor(appPath: string) {
        super()
        this.appPath = appPath;
        this.sleep = SleepMode.no;
        this.init();
    }

    init() {
        this.mpv = Bun.spawn([
            `${this.appPath}/bin/mpv.exe`,
            "--idle",
            `--input-ipc-server=${this.pipePath}`,
            "--no-video",
            "--ao=wasapi",
            "--media-controls=yes",
            "--force-window=no",
            "--cache-pause=no",
            "--profile=low-latency",
            "--ytdl-format=bestaudio",
        ]);

        setTimeout(async () => {
            this.socket = await Bun.connect({
                unix: this.pipePath,
                socket: {
                    open: () => {
                        console.log("Connected.")
                        this.isReady = true
                    },
                    data: (_socket: any, data: any) => {
                        const lines = data.toString().split("\n");
                        for (const line of lines) {
                            if (!line.trim()) continue;
                            try {
                                const response = JSON.parse(line);
                                if (response.request_id === 999 && response.error === "success") {
                                    const mpvQueue = response.data;
                                    this.emit("queue", mpvQueue)
                                }

                                if (response.request_id === 888 && response.error === "success") {
                                    this.emit("time-update", response.data);
                                }

                                if (response.event === "property-change") {
                                    if (response.name === "duration") {
                                        const duration = response.data;
                                        this.emit("duration-update", duration);
                                    }

                                    if (response.name === "pause") {
                                        this.emit("change-playState", !response.data)
                                    }
                                    if (response.name === "path") {
                                        this.emit("playing", response.data)
                                    }
                                }

                                if (response.event === "start-file") {
                                    this.emit("loading", true)
                                }

                                if (response.event === "file-loaded") {
                                    this.emit("loading", false)
                                }

                                if (response.name === "duration") {
                                    const duration = response.data || 0;

                                    if (duration === 0) {
                                        this.emit("is-live", true);
                                    } else {
                                        this.emit("is-live", false);
                                    }
                                }

                                if (response.event === "end-file" && response.reason !== "stop") {
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

        }, 100);
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

    async play(urlOrPath: string) {
        this.send(["stop"]);
        this.send(["playlist-clear"]);
        this.send(["loadfile", urlOrPath, "replace"]);
        setTimeout(() => {

            if (this.isFirstLoad) {
                this.isFirstLoad = false;
                this.send(["set_property", "pause", true]);
            }
            else {
                this.send(["set_property", "pause", false]);
            }

        }, 300);
    }

    getQueue() {
        this.send(["get_property", "playlist"], 999)
    }

    setRepeat(isRepeat: boolean) {
        this.send(["set_property", "loop-file", isRepeat ? "inf" : "no"])
    }

    async addTracks(urls: string[]) {
        for (const url of urls) {
            this.send(["loadfile", url, "append"]);
        }
    }

    setVideoMetadata(thumbnailUrl: string, title: string) {
        this.send(["video-add", thumbnailUrl, "auto"]);

        this.send(["set_property", "metadata/by-key/title", title]);
    }

    next() {
        this.send(["playlist-next"])
    }

    previous() {
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
            }, time * 60 * 60 * 1000);
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