import { Client, SetActivity } from "@xhayper/discord-rpc"
import Player from '../music/index';
import { getDataFromDatabase } from "../lib/database";
import { ActivityType } from "discord-api-types/v10";

export default class Discord {
    public rpc: Client;
    constructor(clientId: string) {
        if (clientId) {
            this.rpc = new Client({ clientId })
            this.rpc?.login().catch(() => { this.rpc = null }).then(() => {
                if (this.rpc) {
                    this.rpc?.on("ready", async () => {
                        console.log("Discord RPC is ready");
                        await this.rpc?.user.setActivity({
                            details: "Idle...",
                            state: "Waiting for music...",
                            startTimestamp: new Date(),
                            largeImageText: "Kuumo app",
                            instance: false
                        })
                    })
                }
            })
        }
    }

    async setMusic(track: any, userData: string, player: Player, current: { time: number, duration: number }) {
        if (track.source === "local") {
            const { title } = track;
            const ytb_tracks = await getDataFromDatabase(userData, "data", "tracks");

            let result: any = null;
            if (!ytb_tracks) return;

            const isYoutube = Object.keys(ytb_tracks).find((key: string) => {
                return ytb_tracks[key].name === title;
            })
            if (isYoutube) {
                result = ytb_tracks[isYoutube];
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

        const activity: SetActivity = {
            type: ActivityType.Listening,
            details: track.title,
            state: track.artist,
            smallImageKey: track.thumbnail,
            smallImageText: track.title,
            instance: false,
        }
        if (track.isPlaying) {
            const now = new Date().getTime();
            const start = (now - current.time * 1000);
            activity.endTimestamp = start + current.duration * 1000;
            activity.startTimestamp = start;
        }
        await this.rpc?.user.setActivity(activity)
    }

    async clearMusic() {
        if (this.rpc) {
            await this.rpc?.user.setActivity({
                details: "Idle...",
                state: "Waiting for music...",
                startTimestamp: new Date(),
                largeImageText: "Kuumo app",
                instance: false
            })
        }
    }
}
