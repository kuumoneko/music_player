import { resolve } from "node:path";

export default async function system(thisWorkSpace: string, isLocal: boolean, isDiscord: boolean, filename: string) {
    const systemFile = Bun.file(
        resolve(thisWorkSpace, "data", "system.json"),
    );
    const system = await systemFile.json();
    system.isLocal = isLocal;
    system.isDiscord = isDiscord;


    await Bun.write(
        resolve(thisWorkSpace, "data", `${filename}.json`),
        JSON.stringify(system),
    );
}