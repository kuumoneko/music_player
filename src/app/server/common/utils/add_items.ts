import { Track } from "../../../../types/index.ts";
import { get } from "./fetch.ts";

export const add_items = async (source: string, mode: string, id: string, after_tracks: any[]) => {
    // console.log("add items")

    let url = `/${mode}/${source}/${id}`;

    if (source === "local") {
        url = `/local/`;
    }
    else if (mode === "liked songs") {
        url = `/liked songs/${source}`;
    }

    const data = await get(url);

    // const res = await fetch(url, {
    //     method: "GET",
    //     headers: {
    //         "Content-Type": "application/json"
    //     }
    // })

    // const data = await res.json();

    const tracks = data.tracks as Track[];

    const shuffle = localStorage.getItem("shuffle") || "disable";

    if (shuffle === "enable") {
        for (let i = tracks.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
        }
    }

    if (after_tracks.length < 20) {
        after_tracks.push(...tracks.slice(0, 20 - after_tracks.length).map((item: Track) => ({
            artists: item.artists.map((artist: any) => artist.name).join(", "),
            duration: item.track.duration,
            id: item.track.id,
            name: item.track.name,
            source: item.type.split(":")[0],
            thumbnail: item.thumbnail,
        })
        ));
    }


    localStorage.setItem("nextfrom", JSON.stringify({
        from: `${source}:${mode}:${id}`,
        tracks: after_tracks,
    }))

}