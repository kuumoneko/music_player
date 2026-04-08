import { UserData } from "@/shared/types.ts";
import { join } from "node:path";

export default async function PlayController(folder:string, data: UserData): Promise<ArrayBuffer> {
    const file = Bun.file(join(folder, data.currentPlaying.id));
    return await file.arrayBuffer();
}