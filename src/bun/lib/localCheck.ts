import { resolve } from "node:path";

export default function checkLocal(appPath: string) {
    const binPath = resolve(appPath, "bin");
    
}