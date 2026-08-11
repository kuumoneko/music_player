import type { System } from "../../../shared/types.ts";
import writeLogs from "../log/write.ts";
import db from "../setup.ts";
import { decodeSystemValue } from "./shared/utils.ts";

const getAll = db.prepare(`SELECT key, value FROM system;`);

const getSystemData = (): Partial<System> => {
    const rows = getAll.all() as { key: string; value: string }[];
    const result: Record<string, unknown> = {};
    for (const row of rows) {
        try {
            result[row.key] = decodeSystemValue(row.key as keyof System, row.value);
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            writeLogs([{ type: "error", message: `Failed to parse system data for key=${row.key}: ${message}` }]);
        }
    }
    return result;
};

export const getSystemDefaults = (): Partial<System> => ({
    isLocal: null,
    isDiscord: null,
    appPort: null,
    DiscordClientId: "",
});

export default getSystemData;
