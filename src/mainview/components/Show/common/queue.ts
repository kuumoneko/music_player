import { Track } from "@/types/index.ts";
import localstorage from "@/utils/localStorage.ts";

export default async function Queue(item: Track, source: string) {

    const queue = localstorage('get', 'play', [])
    const removeDuplicates = (list: any[]) => {
        return Array.from(new Set(list));
    };
    queue.push({
        name: item.name,
        artist: item.artist.map((artist: any) => artist.name).join(", "),
        thumbnail: item.thumbnail,
        source: source,
        id: item.id,
        duration: item.duration,
        time: 0,
    })
    const temp = removeDuplicates(queue);
    localstorage('set', 'play', temp)
}