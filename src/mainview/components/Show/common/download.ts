import { Track } from "@/types/index.ts";
import fetch_data from "@/utils/fetch.ts";

export default async function download(item: Track, source: string) {
    const queue = await fetch_data('profile', 'GET', {
        key: "download"
    });
    queue.push({
        name: item.name,
        mode: "track",
        source: source,
        id: item.id,
    })
    await fetch_data('profile', 'POST', {
        key: "download",
        download: queue
    })
}