import { Track } from "@/shared/types.ts";

export default async function download(item: Track) {
    const queue = await window.api.rpc.request.getUserData("downloadQueue");
    queue.push(`${item.source}:track:${item.id}`)
    await window.api.rpc.request.setUserData({
        key: "downloadQueue",
        data: queue
    })
}