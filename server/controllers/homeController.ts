import { Response } from "express";
import { Artist, CustomRequest } from "../types/index.ts";

export const get = async (req: CustomRequest, res: Response) => {
    try {
        const player = req.player;
        const pin = req.profile?.pin ?? [];

        const artist = pin.filter((item: any) => item.mode === "artist");
        const playlist = pin.filter((item: any) => item.mode === "playlist" || item.mode === "album");

        const ytb_new_tracks = await player.youtube.get_new_tracks(artist.filter((item: Artist) => item.source === "youtube").map((item: Artist) => item.id))
        const spt_new_tracks = await player.spotify.get_new_tracks(artist.filter((item: Artist) => item.source === "spotify").map((item: Artist) => item.id))
        const new_tracks = [...ytb_new_tracks, ...spt_new_tracks];
        return res.status(200).json({
            data: {
                artist: artist,
                playlist: playlist,
                new_tracks: new_tracks
            }
        })
    }
    catch (e) {
        console.error(e);
        res.status(500).json({
            message: e
        })
    }
}