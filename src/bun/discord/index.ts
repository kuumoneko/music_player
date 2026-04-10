import net from "node:net";
import Player from "../music";
import consolelog, { LogType } from "../lib/log.ts"
import { getTrackByName } from "../db/index.ts";

export default class DiscordRPC {
    private socket: net.Socket | null = null;
    private clientId: string;
    public isReady: boolean = false;
    public username: string;

    constructor(clientId: string) {
        this.clientId = clientId;
    }

    async connect() {
        return new Promise((resolve, reject) => {
            this.socket = net.connect('\\\\.\\pipe\\discord-ipc-0');

            this.socket.on('connect', () => {
                consolelog('Connected to pipe, sending handshake...', LogType.Info);
                this.send(0, { v: 1, client_id: this.clientId });
            });

            this.socket.once('data', (data) => {
                const { a: response, evt } = JSON.parse('{"a":' + data.toString().split('"data":')[1]);
                if (response.user !== null) {
                    this.username = response.user.username;
                }

                if (evt === 'READY') {
                    consolelog('Discord is READY!', LogType.Info);
                    this.isReady = true;
                    this.clearMusic();
                    resolve(true);
                }
            });

            this.socket.on('error', (err) => reject(err));
        });
    }

    async setMusic(track: any, player: Player, current: { time: number, duration: number }, isPlaying: boolean) {
        if (!this.isReady) {
            consolelog("Cannot set activity: Discord not ready yet.", LogType.Error);
            return;
        }

        if (track.source === "local") {
            const { title } = track;
            const ytb_tracks = getTrackByName(title, true)

            let result: any = null;
            if (!ytb_tracks) {
                result = ytb_tracks[0]
            }
            else {
                const ytb_search = await player.youtube.search(title, "video");

                if (ytb_search.tracks.length > 0) {
                    result = ytb_search.tracks[0];
                }
                else {
                    result = null;
                }
            }

            track.thumbnail = result ? result.thumbnail : "default";
        }
        else {
            track.thumbnail = `https://i.ytimg.com/vi/${track.id}/default.jpg`;
        }

        const payload = {
            cmd: 'SET_ACTIVITY',
            args: {
                pid: process.pid,
                activity: {
                    type: 2,
                    details: track.title,
                    state: track.arist,
                    assets: {
                        large_image: track.thumbnail, // Ensure this name exists in your Dev Portal
                        large_text: track.title
                    },
                    timestamps: {
                        start: new Date().getTime(),
                        end: new Date().getTime()
                    }
                }
            },
            nonce: crypto.randomUUID()
        };

        if (isPlaying) {
            const now = new Date().getTime();
            const start = (now - current.time * 1000);
            payload.args.activity.timestamps = {
                start: start,
                end: start + current.duration
            }
        }

        this.send(1, payload);
    }

    clearMusic() {
        if (!this.isReady) {
            consolelog("Cannot set activity: Discord not ready yet.", LogType.Error);
            return;
        }

        const payload = {
            cmd: 'SET_ACTIVITY',
            args: {
                pid: process.pid,
                activity: {
                    type: 0,
                    details: "Idling....",
                    state: "Finding a song...",
                    timestamps: {
                        start: Date.now()
                    }
                }
            },
            nonce: crypto.randomUUID()
        };

        this.send(1, payload);
    }

    private send(op: number, payload: object) {
        if (!this.socket) return;
        const json = JSON.stringify(payload);
        const data = Buffer.from(json);
        const header = Buffer.alloc(8);
        header.writeUInt32LE(op, 0);
        header.writeUInt32LE(data.length, 4);
        this.socket.write(header);
        this.socket.write(data);
    }
}