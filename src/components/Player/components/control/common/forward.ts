import { add_items } from "@/utils/add_items.ts";
import localstorage from "@/utils/localStorage.ts";

export default async function forward(
    getUrl: any,
) {
    let playedsongs: any[] = localstorage("get", "playedsongs", []);
    const playing = localstorage("get", "playing", {})
    let playQueue = localstorage("get", "play", []);
    const nextfrom = localstorage("get", "nextfrom", {})

    playedsongs.push({
        artists: typeof playing.artists === "string" ? playing.artists : playing.artists.map((artist: any) => artist.name).join(", "),
        duration: playing.duration,
        id: playing.id,
        name: playing.name,
        source: playing.source,
        thumbnail: playing.thumbnail,
    })

    const uniqueObjectList = Array.from(new Map(playedsongs.map((item: any) => [item.id, item])).values());

    localstorage("set", "playedsongs", uniqueObjectList)

    if (playQueue && playQueue.length > 0) {
        const nextTrack = playQueue[0];
        localstorage("set", "playing", {
            artists: typeof nextTrack.artists === "string" ? nextTrack.artists : nextTrack.artists.map((artist: any) => artist.name).join(", "),
            duration: nextTrack.duration,
            id: nextTrack.id,
            name: nextTrack.name,
            source: nextTrack.source,
            thumbnail: nextTrack.thumbnail,
        })
        playQueue = playQueue.slice(1);
        localstorage("set", "play", playQueue)
    }
    else if (nextfrom.from !== "") {
        const tracks = nextfrom.tracks;
        const [source, mode, id] = nextfrom.from.split(":");
        const track = tracks[0];
        if (mode == "track") {
            await getUrl(playing.source, playing.id);
            localstorage('set', 'playing', {
                artists: typeof track.artists === "string" ? track.artists : track.artists.map((artist: any) => artist.name).join(", "),
                duration: track.duration,
                id: track.id,
                name: track.name,
                source: source,
                thumbnail: track.thumbnail,
            })
        }
        else {
            const tracks: any[] = nextfrom.tracks;
            tracks.shift();

            add_items(source, mode, id, tracks)
            localstorage('set', 'playing', {
                artists: typeof track.artists === "string" ? track.artists : track.artists.map((artist: any) => artist.name).join(", "),
                duration: track.duration,
                id: track.id,
                name: track.name,
                source: source,
                thumbnail: track.thumbnail,
            })
        }
    }
}