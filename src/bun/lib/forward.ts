import { Shuffle, Track } from "../../shared/types";
import Player from "../music";
import consolelog, { LogType } from "../lib/log.ts"
import { getLocalFileById, getUserDatas, writeUserDatas } from "../db/index.ts";

export default async function forward(player: Player) {
    const user = getUserDatas([
        "playedTrack",
        "currentPlaying",
        "playQueue",
        "current",
        "nextfrom",
        "shuffle"
    ])
    user.playedTrack = Array.from(new Set(user.playedTrack.concat([user.currentPlaying.id])));
    if (user.playQueue?.length > 0) {
        const { source, id } = user.playQueue.splice(0, 1)[0]

        if (source === "youtube") {
            const tracks = await player.youtube.fetch_track([id]);
            user.currentPlaying = {
                source: "youtube",
                id: id,
                title: tracks[0].name,
                thumbnail: tracks[0].thumbnail,
                artist: tracks[0].artist.map((item) => { return item.name }).join(", "),
            }
            user.current = {
                time: 0,
                duration: tracks[0].duration,
                isLived: false
            }
        }
        else {
            const track = getLocalFileById(id);
            user.currentPlaying = {
                source: "local",
                id: id,
                thumbnail: track.thumbnail,
                artist: track.artist.map((item) => { return item.name }).join(", "), title: track.name,
            }
            user.current = {
                time: 0,
                duration: track.duration,
                isLived: false
            }
        }
    }
    else if (user.nextfrom.from !== "") {
        const [source, mode, id] = user.nextfrom.from.split(":");
        if (source === "youtube") {
            if (user.nextfrom.next.length < 10) {
                let data: any = null;
                if (mode.includes("artist")) {
                    data = (await player.youtube.fetch_artist(id)).tracks;
                }
                else if (mode.includes("playlist")) {
                    data = (await player.youtube.fetch_playlist(id)).tracks;
                }

                try {
                    if (user.shuffle === Shuffle.Enable) {
                        for (let i = data.length - 1; i > 0; i--) {
                            const j = Math.floor(Math.random() * (i + 1));
                            [data[i], data[j]] = [data[j], data[i]];
                        }
                        user.nextfrom.next.push(...data.slice(0, 25 - (user.nextfrom.next?.length ?? 0)))
                    }
                    else {
                        if (user?.nextfrom?.next?.length > 1) {
                            const last = data.findIndex((item: Track) => item.id === user.nextfrom.next[user.nextfrom.next.length - 1].id);
                            user.nextfrom.next.push(...data.slice(last, last + (25 - (user.nextfrom.next?.length ?? 0))))
                        }
                        else {
                            user.nextfrom.next = data.slice(0, 25)
                        }
                    }

                    if (user.shuffle === Shuffle.Enable) {
                        for (let i = user.nextfrom.next.length - 1; i > 0; i--) {
                            const j = Math.floor(Math.random() * (i + 1));
                            [user.nextfrom.next[i], user.nextfrom.next[j]] = [user.nextfrom.next[j], user.nextfrom.next[i]];
                        }
                    }
                } catch (error) {
                    consolelog(error, LogType.Error)
                }
            }
            const trackId = user.nextfrom.next[0];
            user.nextfrom.next = user.nextfrom.next.slice(1);
            const tracks = await player.youtube.fetch_track([trackId.id]);
            user.currentPlaying = {
                source: "youtube",
                id: trackId.id,
                title: tracks[0].name,
                thumbnail: tracks[0].thumbnail,
                artist: tracks[0].artist.map((item) => { return item.name }).join(", "),

            }
            user.current = {
                time: 0,
                duration: tracks[0].duration,
                isLived: false
            }
        }
        writeUserDatas(user)
    }
    else {
        return null;
    }
}