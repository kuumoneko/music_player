import { ApiRequest } from "../types/index.ts";
import { Response } from "express"

export const give_data = (req: ApiRequest, url: string, data: any, res?: Response) => {
    try {
        req.reply("received_data", (
            {
                ok: true,
                data, url
            }
        ))
    }
    catch {
        if (!res) {
            console.error("");
            return false;
        }

        res.status(data === undefined ? 204 : 200).json({ data });
    }
}

export const give_error = (req: ApiRequest, url: string, statusNo: number, data: any, res?: Response) => {
    try {
        req.reply("received_data", (
            {
                ok: false,
                data, url
            }
        ))
    }
    catch {
        if (!res) {
            console.error("");
            return false;
        }

        res.status(statusNo).json({ message: data });
    }
}