import { Track } from "../../../../../types";

export default function Queue(item: Track, source: string) {
    const queue = JSON.parse(localStorage.getItem("play queue") as string) || [];
    const removeDuplicates = (list: any[]) => {
        return Array.from(new Set(list));
    };
    queue.push({
        name: item.track.name,
        artists: item.artists.map((artist: any) => artist.name).join(", "),
        thumbnail: item.thumbnail,
        source: source,
        id: item.track.id,
        duration: item.track.duration,
        time: 0,
    })
    const temp = removeDuplicates(queue);
    localStorage.setItem("play queue", JSON.stringify(temp));
}