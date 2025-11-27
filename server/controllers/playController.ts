import { Response } from "express";
import { CustomRequest } from "../types/index.ts";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export const get = async (req: CustomRequest, res: Response) => {
    try {
        const { source, id } = req.params;
        const player = req.player;
        let result: any = "";
        if (source === "local") {
            const folder = player.download_folder;
            try {
                const audioBuffer = readFileSync(resolve(folder, id));
                const base64String = audioBuffer.toString('base64');
                result = base64String;
            } catch (error) {
                if (error.code === "ENOENT") {
                    return res.status(404).json({ message: "File not found" });
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
        else if (source === "local") {
            const folder = req.player.download_folder;
            try {
                const audioBuffer = readFileSync(resolve(folder, id));
                const base64String = audioBuffer.toString('base64');
                result = base64String;
            } catch (error) {
                if (error.code === "ENOENT") {
                    return res.status(404).json({ message: "File not found" });
                }
            }
        }
        else {
            return res.status(400).json({ message: "Invalid source" });
        }

        res.status(200).json({
            data: result
        })
    }
    catch (e) {
        console.error(e);
        res.status(500).json({
            message: e
        })
    }
}