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
            "--pause",
            "--ao=wasapi"
        ], { stdout: "inherit" });

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
                                if (response.event === "property-change") {
                                    if (response.name === "time-pos") {
                                        const currentTime = response.data;
                                        this.emit("time-update", currentTime);
                                    }
                                    if (response.name === "duration") {
                                        const duration = response.data;
                                        this.emit("duration-update", duration);
                                    }
                                }

                                if (response.event === "start-file") {
                                    this.emit("loading")
                                }

                                if (response.event === "file-loaded") {
                                    this.emit("ready")
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
                                    this.emit("ended");
                                }
                            } catch (e) { writeLogs([{ type: "error", message: e }]) }
                        }
                    },
                    error: (_socket: any, error: any) => {
                        console.error("IPC Socket Error:", error);
                    }
                }
            });
            this.send(["observe_property", 1, "time-pos"]);
            this.send(["observe_property", 2, "duration"]);
            setInterval(() => {
                this.send(["observe_property", 1, "time-pos"]);
                this.send(["observe_property", 2, "duration"]);
                // this.send(["observe_property", 4, "media-title"]);
            }, 1000);
        }, 1000);
    }

    private send(command: (string | number | boolean)[]) {
        if (this.socket && typeof this.socket.write === "function") {
            const msg = JSON.stringify({ command }) + "\n";
            this.socket.write(msg);
        }
    }

    play(urlOrPath: string) {
        this.send(["stop"]);

        this.send(["loadfile", urlOrPath, "replace"]);
        if (this.isFirstLoad) {
            this.isFirstLoad = false;
            this.send(["set_property", "pause", true]);
        }
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

        // 1. Tell MPV to quit politely via IPC
        if (this.socket) {
            this.send(["quit"]);
            this.socket.end(); // Close the socket
        }

        // 2. Give it a tiny moment to exit, then force kill if it's still there
        setTimeout(() => {
            if (this.mpv && this.mpv.exitCode === null) {
                this.mpv.kill();
            }
        }, 100);
    }
}