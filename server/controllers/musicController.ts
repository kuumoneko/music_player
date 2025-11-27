import { Response } from "express";
import { CustomRequest, Track } from "../types/index.ts";
import wait_for_downloader from "../lib/player.ts";

export const get = async (req: CustomRequest, res: Response) => {
    try {
        const { source, type, id } = req.params;
        const { player } = req;

        await wait_for_downloader(player);
        let result: any = null;
        if (source === "spotify") {
            if (type === "tracks") {
                result = await player.spotify.fetch_track(typeof id === "string" ? [id] : id);
            }
            else if (type === "playlists") {
                result = await player.spotify.fetch_playlist(id);
            }
            else if (type === "artists") {
                result = await player.spotify.fetch_artist(id);
            }
            else if (type === "albums") {
                result = await player.spotify.fetch_album(typeof id === "string" ? [id] : id);
            }
            else {
                return res.status(400).json({ message: "Invalid type" });
            }
        }
        else if (source === "youtube") {
            if (type === "tracks") {
                result = await player.youtube.fetch_track(typeof id === "string" ? [id] : id);
            }
            else if (type === "playlists") {
                result = await player.youtube.fetch_playlist(id);
            }
            else if (type === "artists") {
                result = await player.youtube.fetch_artist(id);
            }
            else {
                return res.status(400).json({ message: "Invalid type" });
            }
        }
        else if (
            source === "local"
        ) {
            try {
                result = {
                    tracks: player.local.data
                };
            } catch (error) {
                if (error.code === "ENOENT") {
                    return res.status(404).json({ message: "Folder not found" });
                }
            }
        }
        else { return res.status(400).json({ message: "Invalid source" }); }

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