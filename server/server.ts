import { mkdir } from "node:fs/promises";
import Downloader from "./downloader/index.ts";
import { download_mode } from "./downloader/music/types.ts";

export default async function run(downloader: Downloader, folder: string, links: string[], checking: boolean) {
    await mkdir(`${folder}`, { recursive: true });

    if (links.length === 0) {
        console.error("No links found");
        return;
    }
    if (folder as string === "No folder found") {
        console.error("No folder found, please use --folder or -f to specify the folder");
        return;
    }

    await downloader.add_to_queue({
        mode: download_mode.audio,
        link: links
    })

    if (checking === true) {
        await downloader.checking();
    }
    await downloader.download("not zip");
}

