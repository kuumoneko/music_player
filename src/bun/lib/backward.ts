import { UserData } from "@/shared/types";
import Player from "../music";

export default async function backward(player: Player, user: UserData) {
    const preTrack = user.playedTrack.splice(0, 1);
    user.queue.unshift(
        {
            id: user.currentPlaying.id,
            source: user.currentPlaying.source as any
        } as any
    )
    if (preTrack.length > 0) {
        const [source, id] = preTrack[0].split(":");

        if (source === "youtube") {
            const tracks = await player.youtube.fetch_track([id]);
            user.currentPlaying = {
                source: "youtube",
                id: id,
                title: tracks[0].name,
                thumbnail: tracks[0].thumbnail,
                artist: tracks[0].artist.map((item) => { return item.name }).join(", "),
                liveBroadcastContent: tracks[0].liveBroadcastContent
            }
            user.current = {
                time: 0,
                duration: tracks[0].duration,
                isLived: tracks[0].liveBroadcastContent
            }
        }
        else {
            const track = player.local.data.find((localItem) => localItem.id === id);
            user.currentPlaying = {
                source: "local",
                id: id,
                thumbnail: track.thumbnail,
                artist: track.artist.map((item) => { return item.name }).join(", "),
                title: track.name,
                liveBroadcastContent: track.liveBroadcastContent
            }
            user.current = {
                time: 0,
                duration: track.duration,
                isLived: track.liveBroadcastContent
            }

        }
    }
    else {
        return null;
    }
}