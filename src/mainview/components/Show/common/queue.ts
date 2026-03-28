import { Track } from "@/shared/types.ts";

export default async function Queue(item: Track) {
    const queue = await window.api.rpc.request.getUserData("queue");
    const removeDuplicates = (list: any[]) => {
        return Array.from(new Set(list));
    };
    queue.push(item)
    const temp = removeDuplicates(queue);
    window.api.rpc.request.setUserData({ key: "queue", data: temp });
}