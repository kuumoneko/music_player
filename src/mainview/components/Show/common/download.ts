import { Artist, Playlist, Track } from "@/shared/types.ts";

export default async function download(item: Track | Playlist | Artist, type: "tracks" | "playlists" | "artists") {
    const queue = await window.api.rpc.request.getUserData("downloadQueue");
    queue.push(`${item.source}:${type}:${item.id}`)
    await window.api.rpc.request.setUserData({
        key: "downloadQueue",
        data: queue
    })
}
