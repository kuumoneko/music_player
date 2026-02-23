import { Utils } from "electrobun";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export default async function ImportControllers(executableDir: string) {
    const result = await Utils.openFileDialog({
        canChooseFiles: false,
        canChooseDirectory: true
    })
    const path = result[0];
    const files = [];
    readdirSync(path, { recursive: true }).forEach((file) => {
        if (String(file).includes(".json")) {
            const content = readFileSync(resolve(path, file), { encoding: "utf-8" });
            files.push({
                path: String(file),
                content: content
            })
        }
    })

    files.forEach((file: { path: string, content: string }) => {
        const data_path = resolve(executableDir, "data", file.path);
        writeFileSync(data_path, file.content, { encoding: "utf-8" });
    })
}
