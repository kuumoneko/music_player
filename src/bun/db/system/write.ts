import type { System } from "../../../shared/types.ts";
import db from "../setup.ts";
import { encodeSystemValue } from "./shared/utils.ts";

const upsert = db.prepare(`
  INSERT INTO system (key, value)
  VALUES ($key, $value)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
`);

const writeSystemData = db.transaction((data: Partial<System>) => {
    for (const [key, value] of Object.entries(data)) {
        if (value === undefined) continue;
        upsert.run({
            $key: key,
            $value: encodeSystemValue(key as keyof System, value),
        });
    }
});

export default writeSystemData;
