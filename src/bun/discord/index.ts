import net from "node:net";
import Player from "../music/index.ts";
import { getTrackByName, writeLogs } from "../db/index.ts";
import os from "node:os"
import { MusicSource, MusicType, Track } from "../../shared/types.ts";

const pipePath = os.platform() === 'win32'
    ? '\\\\?\\pipe\\discord-ipc-0'
    : `/tmp/discord-ipc-0`;

export default class DiscordRPC {
    private socket: net.Socket | null = null;
    private clientId: string;
    public isReady: boolean = false;
    public username: string | null | undefined;

    constructor(clientId: string) {
        this.clientId = clientId;
    }

    isDiscordRun() {
        return new Promise((resolve) => {
            const socket = net.connect(pipePath);
            socket.on('connect', () => {
                resolve(true);
            });
            socket.on('error', () => {
                this.isReady = false;
                this.username = null;
                this.socket = null;
                resolve(false);
            });
        })
    }

    async connect() {
        return new Promise((resolve, reject) => {
            this.socket = net.connect(pipePath);
            this.socket.on('connect', () => {
                writeLogs([{ type: "info", message: "Connected to pipe, sending handshake..." }]);
                this.send(0, { v: 1, client_id: this.clientId });
            });

            let resolved = false;
            this.socket.on('data', (data: Buffer) => {
                try {
                    const json = JSON.parse(data.subarray(8).toString());
                    if (json.evt === 'READY') {
                        writeLogs([{ type: "info", message: "Connected to Discord, client is Ready..." }]);
                        this.isReady = true;
                        this.username = json.data?.user?.username ?? null;
                        if (!resolved) { resolved = true; resolve(true); }
                    }
                } catch (e) {
                    const message = e instanceof Error ? e.message : String(e);
                    writeLogs([{ type: "error", message }]);
                }
            });
            this.socket.on('error', (err) => { if (!resolved) { resolved = true; reject(err); } });
            this.socket.on("close", () => {
                if (!resolved) { resolved = true; resolve(false); }
            })
        });
    }

    async setMusic(track: { source: string, id: string, title: string, thumbnail: string, artist: string } | null, player: Player, current: { time: number, duration: number }) {
        if (!this.isReady || track === null) {
            return;
        }

        if (track.source === MusicSource.Local) {
            const { title } = track;
            const ytbTracks = getTrackByName(title, true)

            let result: Track | null = null;
            if (ytbTracks && ytbTracks.length > 0) {
                result = ytbTracks[0];
            }
            else {
                const ytbSearch = await player.youtubeDataAPI.search(title, MusicType.Track) ?? { tracks: [] };

                if (ytbSearch.tracks.length > 0) {
                    result = ytbSearch.tracks[0];
                }
                else {
                    result = null;
                }
            }

            track.thumbnail = result ? result?.thumbnail : "default";
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
                    status_display_type: 0,
                    details: track.title,
                    state: track.artist.length > 0 ? track.artist : "Kuumo App",
                    assets: {
                        large_image: track.thumbnail,
                        large_text: track.title
                    },
                    timestamps: {
                        start: Date.now(),
                        end: Date.now()
                    }
                }
            },
            nonce: crypto.randomUUID()
        };

        const now = Date.now();
        const start = (now - current.time * 1000);
        payload.args.activity.timestamps = {
            start: start,
            end: start + current.duration
        }
        this.send(1, payload);
    }

    clearMusic() {
        if (!this.isReady) {
            return;
        }

        const payload = {
            cmd: 'SET_ACTIVITY',
            args: {
                pid: process.pid,
                activity: null
            },
            nonce: crypto.randomUUID()
        };

        this.send(1, payload);
    }

    disconnect() {
        this.clearMusic();
        this.isReady = false;
        this.username = null;
        if (this.socket) {
            this.socket.end();
            this.socket = null;
        }
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