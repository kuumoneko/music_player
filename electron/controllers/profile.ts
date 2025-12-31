import { writeDataToDatabase } from "../lib/database.ts";
import wait_for_downloader from "../lib/player.ts";
import Player from "../music/index.ts";
import path from "node:path";

export default async function ProfileController(player: Player, profile: any, data: any) {
    await wait_for_downloader(player);
    const { mode, key, ...receivedData } = data;

    try {
        if (mode === "GET") {
            return profile[key] ?? (key === "folder" ? "" : []);
        }
        else if (mode === "POST") {
            if (key === "folder") {
                if (!path.isAbsolute(receivedData[key])) {
                    throw new Error("Path must be absolute")
                }
                player.local.data = [];
                player.local.getfolder(data[key]);
            }
            profile[key] = receivedData[key];
            writeDataToDatabase(player.folder, "data", "profile", profile)
            return "ok"
        }
        else {
            throw new Error("Invalid mode")
        }
    }
    catch (e) {
        throw e
    }
}