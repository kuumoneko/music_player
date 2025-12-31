import wait_for_downloader from "../lib/player";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export default async function PlayController(player: any, data: any): Promise<string> {
    await wait_for_downloader(player);
    const { source, id } = data;
    let result: any = "";

    if (source === "local") {
        const folder = player.download_folder;
        try {
            const audioBuffer = readFileSync(resolve(folder, id));
            const base64String = audioBuffer.toString('base64');
            result = base64String;
        } catch (error: any) {
            if (error.code === "ENOENT") {
                throw new Error("File not found");
            }
        }
    }
    else if (source === "spotify" || source === "youtube") {
        let musicId = "";
        if (source === "spotify") {
            const track = (await player.spotify.fetch_track([id]))[0];
            if (track.matched) {
                musicId = track.matched;
            }
            else {
                const matchedTrack = await player.findMatchingVideo(track);
                if (matchedTrack) {
                    musicId = matchedTrack.id;
                    player.spotify.writedata("tracks", [id], [{
                        ...track,
                        matched: musicId
                    }])
                }
            }
        }
        else if (source === "youtube") {
            musicId = id;
        }
        if (musicId) {
            const url = await player.getAudioURLAlternative(musicId);
            if (url) {
                result = url;
            }
        }
    }
    else {
        throw new Error("Invalid source");
    }
    return result;
}