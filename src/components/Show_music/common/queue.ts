import { Track } from "../../../types";
import fetch_profile, { LocalStorageKeys } from "../../../utils/localStorage";

export default async function Queue(item: Track, source: string) {
    const queue = await fetch_profile("get", LocalStorageKeys.play);
    const removeDuplicates = (list: any[]) => {
        return Array.from(new Set(list));
    };
    queue.push({
        name: item.track?.name,
        artists: item.artists?.map((artist: any) => artist.name).join(", "),
        thumbnail: item.thumbnail,
        source: source,
        id: item.track?.id,
        duration: item.track?.duration,
        time: 0,
    })
    const temp = removeDuplicates(queue);
    await fetch_profile("write", LocalStorageKeys.play, temp);
}