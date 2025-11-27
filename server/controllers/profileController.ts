import { Response } from "express";
import { parse_body } from "../lib/request_body.js";
import { CustomRequest } from "../types/index.ts";
import {  writeDataToDatabase } from "../lib/database.ts";
import path from "node:path";

export const get = (req: CustomRequest, res: Response) => {
    try {
        const { key } = req.params;
        const player = req.player;
        const profile = req.profile
        if (key === "folder") {
            return res.status(200).json({
                data: profile[key] ?? ""
            })
        }
        else {
            return res.status(200).json({
                data: profile[key] ?? []
            })
        }
    }
    catch (e) {
        console.error(e);
        res.status(500).json({
            message: e
        })
    }
}

export const post = (req: CustomRequest, res: Response) => {
    try {
        const { key } = req.params
        const data = parse_body(req.body);
        const player = req.player;
        const folder = player.folder;
        const profile = req.profile

        if (key === "folder") {
            if (!path.isAbsolute(data[key])) {
                return res.status(400).json({ message: "Path must be absolute" });
            }
            player.local.data = [];
            player.local.getfolder(data[key]);
        }
        profile[key] = data[key];
        writeDataToDatabase(folder, "data", "profile", profile)

        res.status(204).json()
    }
    catch (e) {
        console.error(e);
        res.status(500).json({
            message: e
        })
    }
}