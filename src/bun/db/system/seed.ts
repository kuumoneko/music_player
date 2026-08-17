import { join } from "node:path";
import { rm } from "node:fs/promises";
import type { System } from "../../../shared/types.ts";
import writeLogs from "../log/write.ts";
import db from "../setup.ts";
import writeSystemData from "./write.ts";
import getSystemData, { getSystemDefaults } from "./get.ts";

const OBSOLETE_USER_DATA_KEYS = ["youtubeApiKeys", "googleClientId", "googleClientSecret"];

const purgeObsoleteUserData = db.prepare(
    `DELETE FROM user_data WHERE key IN (SELECT value FROM json_each($keys));`
);

export interface SeedOptions {
    // Force-delete system.json after a successful seed (installer mode).
    deleteFile?: boolean;
}

async function retryBusy<T>(fn: () => T): Promise<T> {
    let attempt = 1;
    while (true) {
        try {
            return fn();
        } catch (e) {
            const busy = e instanceof Error && /database is locked|busy/i.test(e.message);
            if (!busy || attempt >= 5) throw e;
            await new Promise((r) => setTimeout(r, 500 * attempt));
            attempt++;
        }
    }
}

// Copies data/system.json from the app assets into the system table on first
// run (and again after each app update), then deletes the file so shipped
// credentials only live inside app_data.sqlite. Dev keeps the file — it is the
// bake target that scripts regenerate on every dev launch.
export async function seedSystemFromAssets(assetsDir: string, options: SeedOptions = {}): Promise<Partial<System>> {
    const filePath = join(assetsDir, "data", "system.json");
    try {
        const file = Bun.file(filePath);
        if (await file.exists()) {
            const data = await file.json() as System | null;
            if (data) {
                await retryBusy(() => writeSystemData(data));
                await retryBusy(() => purgeObsoleteUserData.run({ $keys: JSON.stringify(OBSOLETE_USER_DATA_KEYS) }));
                const shouldDelete = options.deleteFile ?? process.env["KUUMO_DEV"] !== "1";
                if (shouldDelete) {
                    try {
                        await rm(filePath);
                        writeLogs([{ type: "info", message: "Seeded system.json into app_data.sqlite and removed the file." }]);
                    } catch (e) {
                        const message = e instanceof Error ? e.message : String(e);
                        writeLogs([{ type: "error", message: `Failed to remove system.json after seeding: ${message}` }]);
                    }
                }
                return { ...getSystemDefaults(), ...getSystemData(), ...data };
            }
        }
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        writeLogs([{ type: "error", message: `Failed to seed system.json: ${message}` }]);
    }
    return { ...getSystemDefaults(), ...getSystemData() };
}
