import localstorage from "@/utils/localStorage.ts";

export default async function backward() {
    let playedsongs: any[] = localstorage("get", "playedsongs", []);
    const playing = localstorage("get", "playing", {})
    const queue = localstorage("get", "play", [])
    const backward = playedsongs.pop();

    localstorage("set", "playing", {
        artist: typeof backward.artists === "string" ? backward.artists : backward.artists ? backward.artists.map((artist: any) => artist.name).join(", ")
            : typeof backward.artist === "string" ? backward.artist : backward.artist.map((artist: any) => artist.name).join(", "),
        duration: backward.duration,
        id: backward.id,
        name: backward.name,
        source: backward.source,
        thumbnail: backward.thumbnail,
    })
    localstorage("set", "playedsongs", playedsongs);
    localstorage("set", "play", [
        {
            artist: typeof playing.artists === "string" ? playing.artists : playing.artists ? playing.artists.map((artist: any) => artist.name).join(", ")
                : typeof playing.artist === "string" ? playing.artist : playing.artist.map((artist: any) => artist.name).join(", "),
            duration: playing.duration,
            id: playing.id,
            name: playing.name,
            source: playing.source,
            thumbnail: playing.thumbnail,
        },
        ...queue
    ])
}