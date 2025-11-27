import { Track } from "@/types/index.ts";
import localstorage from "@/utils/localStorage.ts";

export default async function Play(item: Track, source: string, mode: string, id: string, list: any) {
    localstorage("set", "play", []);
    localstorage("set", 'playing', {
        name: item.name,
        artists: item.artist?.map((artist: any) => artist.name).join(", "),
        thumbnail: item.thumbnail,
        source: source,
        id: item.id,
    })
    localstorage("set", "time", "0");
    const temp = localstorage("get", "repeat", "disable");
    localstorage("set", "repeat", (temp === "disable") ? "disable" : "enable");


    let playedsongs = localstorage("get", 'playedsongs', [])
    const playing = localstorage('get', 'playing', {})
    playedsongs.push({
        artists: typeof playing.artists === "string" ? playing.artists : playing.artists.map((artist: any) => artist.name).join(", "),
        duration: playing.duration,
        id: playing.id,
        name: playing.name,
        source: playing.source,
        thumbnail: playing.thumbnail,
    })

    const uniqueObjectList = Array.from(new Map(playedsongs.map((item: any) => [item.id, item])).values());

    localstorage('set', 'playedsongs', uniqueObjectList)

    if (mode === "track") {
        localstorage('set', 'nextfrom', {
            from: `${source}:${mode}:${id}`,
            tracks: [
                {
                    name: item.name,
                    artists: item.artist?.map((artist: any) => artist.name).join(", "),
                    thumbnail: item.thumbnail,
                    source: source,
                    id: item.id,
                    duration: item.duration
                }
            ]
        })

    }
    else if (mode === "playlist" || mode === "liked songs" || mode === "local") {
        const other_tracks: any[] = list?.filter((track: any) => item.id !== track.id) || [];

        if (other_tracks.length > 0) {
            // check the shuffle mode
            const shuffle = localstorage("get", 'shuffle', 'disable')
            if (shuffle === "enable") {
                for (let i = other_tracks.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [other_tracks[i], other_tracks[j]] = [other_tracks[j], other_tracks[i]];
                }
            }
            localstorage('set', "nextfrom", {
                from: `${source}:${mode}:${id}`,
                tracks: other_tracks.slice(0, 20).map((track: Track) => {
                    return {
                        name: track.name,
                        artists: track.artist.map((artist: any) => artist.name).join(", "),
                        thumbnail: track.thumbnail,
                        source: source,
                        id: track.id,
                        duration: item.duration

                    }
                })
            })
        }
    }
    else if (mode === "search") {
        localstorage('set', "nextfrom", {
            from: `${source}:track:${id}`,
            tracks: [
                {
                    name: item.name,
                    artists: item.artist.map((artist: any) => artist.name).join(", "),
                    thumbnail: item.thumbnail,
                    source: source,
                    id: item.id,
                    duration: item.duration
                }
            ]
        })
    }
}