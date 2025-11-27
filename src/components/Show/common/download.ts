import { Track } from "@/types/index.ts";
import fetch_data from "@/utils/fetch.ts";

export default async function download(item: Track, source: string) {
    const queue = await fetch_data('/profile/download', 'GET');
    queue.push({
        name: item.name,
        mode: "track",
        source: source,
        id: item.id,
    })
    await fetch_data('/profile/download','POST', queue)
}