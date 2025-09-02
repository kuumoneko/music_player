import { Track } from "../../../../../types";
import fetch_profile, { LocalStorageKeys } from "../../../utils/localStorage";

export default async function download(item: Track, source: string) {
    const queue = await fetch_profile("get", LocalStorageKeys.download);
    queue.push({
        name: item.track?.name,
        mode: "track",
        source: source,
        id: item.track?.id,
    })
    await fetch_profile("write", LocalStorageKeys.download, queue);
}