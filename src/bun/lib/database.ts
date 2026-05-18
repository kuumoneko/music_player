import { join } from "node:path";
import { rename } from "node:fs/promises";
import { writeLogs } from "../db";

/**
     * Get data from database
     * args[-1] is filename
*/
export async function getDataFromDatabase(...args: string[]): Promise<any> {
    const filename = args[args.length - 1];
    const filePath = join(...args.slice(0, -1), `${filename}.json`);
    try {
        const file = Bun.file(filePath);
        const isExisted = await file.exists();
        if (isExisted) {
            const data = await file.json();
            return data;
        }
        else {
            throw new Error(`Database file not found at: ${filePath}`);
        }
    } catch (error) {
        writeLogs([{ type: "error", message: `Failed to read database file: ${filePath} \n Error: ${error}` }]);
        return null
    }
}

/**
     * Write data to database
     * args[-1] is data
     * args[-2] is filename
*/
export async function writeDataToDatabase(...args: any[]) {
    const filename = args[args.length - 2];
    const data = args[args.length - 1];

    const filePath = join(...args.slice(0, -2), `${filename}.json`);
    try {

        await Bun.write(`${filePath}.tmp`, JSON.stringify(data, null, 2), { createPath: true });
        await rename(`${filePath}.tmp`, filePath);
    } catch (error) {
        writeLogs([{
            type: "error", message: `Failed to write to database file: ${filePath} \n Error: ${error}`
        }])
    }
}
