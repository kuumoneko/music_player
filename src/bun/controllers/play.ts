import { join } from "node:path";
import { getUserData } from "../db";

export default async function PlayController(folder: string): Promise<Response> {
    const currentPlaying = getUserData("currentPlaying")
    const file = Bun.file(join(folder, currentPlaying.id));
    return new Response(file.stream());
}