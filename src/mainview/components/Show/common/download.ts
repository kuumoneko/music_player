import { Track } from "@/shared/types.ts";

export default async function download(item: Track, source: string) {
    const queue = await window.api.rpc.request.getProfileData("download");
    queue.push({
        id: item.id,
        name: item.name,
        source: source,
        mode: "track"
    })
    await window.api.rpc.request.setProfileData({
        key: "download",
        data: queue
    })
}