import { MutableRefObject } from "react";
import { add_items } from "../../../../../utils/add_items.ts";
import fetch_profile, { LocalStorageKeys } from "../../../../../utils/localStorage.ts";
// import { getUrl } from "../index.tsx";

export default async function forward(
    getUrl: (source: string,
        id: string,
        autoplayed: boolean) => Promise<void>,
    // audioRef: MutableRefObject<HTMLAudioElement>,
    // setplayed: (a: boolean) => void,
    // setisloading: (a: boolean) => void,
    // setduraion: (a: number) => void
) {
    let playedsongs: any[] = JSON.parse(localStorage.getItem("playedsongs") || "[]");
    const playing = JSON.parse(localStorage.getItem("playing") as string);
    let playQueue = await fetch_profile("get", LocalStorageKeys.play);
    const nextfrom = await fetch_profile("get", LocalStorageKeys.nextfrom)

    playedsongs.push({
        artists: typeof playing.artists === "string" ? playing.artists : playing.artists.map((artist: any) => artist.name).join(", "),
        duration: playing.duration,
        id: playing.id,
        name: playing.name,
        source: playing.source,
        thumbnail: playing.thumbnail,
    })

    const uniqueObjectList = Array.from(new Map(playedsongs.map((item: any) => [item.id, item])).values());


    localStorage.setItem("playedsongs", JSON.stringify(uniqueObjectList));



    if (playQueue && playQueue.length > 0) {
        const nextTrack = playQueue[0];  // Play the first track

        localStorage.setItem("playing", JSON.stringify({
            artists: typeof nextTrack.artists === "string" ? nextTrack.artists : nextTrack.artists.map((artist: any) => artist.name).join(", "),
            duration: nextTrack.duration,
            id: nextTrack.id,
            name: nextTrack.name,
            source: nextTrack.source,
            thumbnail: nextTrack.thumbnail,
        }));
        playQueue = playQueue.slice(1);  // Remove the played track from the queue
        await fetch_profile("write", LocalStorageKeys.play, playQueue)
    }
    else if (nextfrom.from !== "") {
        const tracks = nextfrom.tracks;
        const [source, mode, id] = nextfrom.from.split(":");
        const track = tracks[0];
        if (mode == "track") {
            await getUrl(playing.source, playing.id, true);

            localStorage.setItem("playing", JSON.stringify({
                artists: typeof track.artists === "string" ? track.artists : track.artists.map((artist: any) => artist.name).join(", "),
                duration: track.duration,
                id: track.id,
                name: track.name,
                source: source,
                thumbnail: track.thumbnail,
            }));
        }
        else {
            const tracks: any[] = nextfrom.tracks;
            tracks.shift();

            add_items(source, mode, id, tracks)


            localStorage.setItem("playing", JSON.stringify({
                artists: typeof track.artists === "string" ? track.artists : track.artists.map((artist: any) => artist.name).join(", "),
                duration: track.duration,
                id: track.id,
                name: track.name,
                source: source,
                thumbnail: track.thumbnail,
            }));
        }
    }
}