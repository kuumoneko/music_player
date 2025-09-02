import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
     * Get data from database
     * args[-1] is filename
*/
export function getDataFromDatabase(...args: string[]): any {
    const filename = args[args.length - 1];
    const filePath = path.join(...args.slice(0, -1), `${filename}.json`);
    try {
        if (!existsSync(filePath)) {
            throw new Error(`Database file not found at: ${filePath}`);
        }
        const dataFromFile = readFileSync(filePath, { encoding: "utf-8" });
        return JSON.parse(dataFromFile);
    } catch (error) {
        return null
    }
}

/**
     * Write data to database
     * args[-1] is data
     * args[-2] is filename
*/
export function writeDataToDatabase(...args: any[]): void {
    const filename = args[args.length - 2];
    const data = args[args.length - 1];

    const filePath = path.join(...args.slice(0, -2), `${filename}.json`);
    try {
        writeFileSync(filePath, JSON.stringify(data, null, 4), { encoding: "utf-8" });
    } catch (error) {
        console.error(`Failed to write to database file: ${filePath}`, error);
    }
}
