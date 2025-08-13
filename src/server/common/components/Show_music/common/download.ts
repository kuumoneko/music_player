import { Track } from "../../../../../types";

export default function download(item: Track, source: string) {
    const queue = JSON.parse(localStorage.getItem("download queue") as string) || [];
    queue.push({
        name: item.track.name,
        mode: "track",
        source: source,
        id: item.track.id,
    })
    localStorage.setItem("download queue", JSON.stringify(queue));
}