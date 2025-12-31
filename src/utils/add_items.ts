import { Track } from "../types/index.ts";
import fetchdata from "@/utils/fetch.ts"
import localstorage from "./localStorage.ts";

export const add_items = async (source: string, mode: string, id: string, after_tracks: any[]) => {
    let data: any;

    if (mode.includes(
        "playlist"
    )) {
        data = await fetchdata(`music`, "GET", {
            source, type: "playlists", id
        })
    }
    else if (mode.includes(
        "track"
    )) {
        data = await fetchdata(`music`, "GET", {
            source, type: "tracks", id
        })
    }
    else if (mode.includes("artist")) {
        data = await fetchdata(`music`, "GET", {
            source, type: "artists", id
        });
    }
    else if (mode.includes(
        "local"
    )) {
        data = await fetchdata("music", "GET", {
            mode: "local",
            type: "local",
            id: "local"
        });
    }
    const tracks = data.tracks as Track[];

    const shuffle = localstorage('get', 'shuffle', 'disable')

    if (shuffle === "enable") {
        for (let i = tracks.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
        }
    }

    if (after_tracks.length < 20) {
        after_tracks.push(...tracks.slice(0, 20 - after_tracks.length).map((item: Track) => ({
            artist: item.artist?.map((artist: any) => artist.name).join(", "),
            duration: item.duration,
            id: item.id,
            name: item.name,
            source: item.source,
            thumbnail: item.thumbnail,
        })
        ));
    }

    localstorage('set', 'nextfrom', {
        from: `${source}:${mode}:${id}`,
        tracks: after_tracks,
    })

}