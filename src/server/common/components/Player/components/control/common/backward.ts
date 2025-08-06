
export default function backward() {
    let playedsongs: any[] = JSON.parse(localStorage.getItem("playedsongs") || "[]");
    const playing = JSON.parse(localStorage.getItem("playing") as string);
    const queue = JSON.parse(localStorage.getItem("play queue") as string);
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

    localStorage.setItem("play queue", JSON.stringify([
        {
            artists: typeof playing.artists === "string" ? playing.artists : playing.artists.map((artist: any) => artist.name).join(", "),
            duration: playing.duration,
            id: playing.id,
            name: playing.name,
            source: playing.source,
            thumbnail: playing.thumbnail,
        },
        ...queue
    ]));
}