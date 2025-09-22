import fetch_profile, { LocalStorageKeys } from "../../../../../utils/localStorage";

export default async function backward() {
    let playedsongs: any[] = JSON.parse(localStorage.getItem("playedsongs") || "[]");
    const playing = JSON.parse(localStorage.getItem("playing") as string);
    const queue = await fetch_profile("get", LocalStorageKeys.play);
    const backward = playedsongs.pop();

    localStorage.setItem("playing", JSON.stringify({
        artists: typeof backward.artists === "string" ? backward.artists : backward.artists.map((artist: any) => artist.name).join(", "),
        duration: backward.duration,
        id: backward.id,
        name: backward.name,
        source: backward.source,
        thumbnail: backward.thumbnail,
    }))

    localStorage.setItem("playedsongs", JSON.stringify(playedsongs))

    await fetch_profile("write", LocalStorageKeys.play, [
        {
            artists: typeof playing.artists === "string" ? playing.artists : playing.artists.map((artist: any) => artist.name).join(", "),
            duration: playing.duration,
            id: playing.id,
            name: playing.name,
            source: playing.source,
            thumbnail: playing.thumbnail,
        },
        ...queue
    ])
}