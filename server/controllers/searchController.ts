import { Response } from "express";
import { CustomRequest } from "../types/index.ts";

export const get = async (req: CustomRequest, res: Response) => {
    try {
        const { source, type, query } = req.params;
        const player = req.player;
        let result: any = null;
        if (source === "spotify") {
            result = await player.spotify.search(query as string, type as any);
        }
        else if (source === "youtube") {
            result = await player.youtube.search(query as string, type as any);
        }
        return res.status(200).json({
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