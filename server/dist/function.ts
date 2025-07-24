import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

// --- Database Helper Functions with Error Handling ---
export function getDataFromDatabase(executableDir: string, folder: string, file: string): any {

    const filePath = path.join(executableDir, folder, `${file}.json`);
    try {
        if (!existsSync(filePath)) {
            throw new Error(`Database file not found at: ${filePath}`);
        }
        const dataFromFile = readFileSync(filePath, { encoding: "utf-8" });
        return JSON.parse(dataFromFile);
    } catch (error) {
        console.error(`Failed to read or parse database file: ${filePath}`, error);
        // Exiting because system configuration is critical
        process.exit(1);
    }
}

export function writeDataToDatabase(executableDir: string, folder: string, file: string, data: any): void {
    const filePath = path.join(executableDir, folder, `${file}.json`);
    try {
        writeFileSync(filePath, JSON.stringify(data, null, 4), { encoding: "utf-8" }); // Added pretty-printing (null, 4)
    } catch (error) {
        console.error(`Failed to write to database file: ${filePath}`, error);
    }
}