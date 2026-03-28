import { UserData } from "@/shared/types.ts";
import wait_for_downloader from "../lib/player";
import Player from "../music/index.ts";
import { join } from "node:path";

export default async function PlayController(player: Player, data: UserData): Promise<ArrayBuffer> {
    await wait_for_downloader(player);
    const folder = player.download_folder;
    const file = Bun.file(join(folder, data.currentPlaying.id));
    return await file.arrayBuffer();
}