import { Track } from "@/shared/types.ts";

export default async function Queue(item: Track) {
    const queue = await window.api.rpc.request.getUserData("playQueue");
    const removeDuplicates = (list: any[]) => {
        return Array.from(new Set(list));
    };
    queue.push(`${item.source}:${item.id}`)
    const temp = removeDuplicates(queue);
    window.api.rpc.request.setUserData({ key: "playQueue", data: temp });
}