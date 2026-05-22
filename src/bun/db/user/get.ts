import type { UserData } from "../../../shared/types.ts";
import writeLogs from "../log/write.ts";
import db from "../setup.ts"

const getData = db.prepare(`
  SELECT 
    t.key, t.value
  FROM user_data t
  WHERE t.key = ?;
`);

const getMultiStmt = db.prepare(`
  SELECT key, value 
  FROM user_data 
  WHERE key IN (SELECT value FROM json_each($keys));
`);

const getUserData = <K extends keyof UserData>(key: K) => {
  if (!key) return null;

  const value = getData.get(key) as { key: string; value: string };
  if (value === null || value === undefined) return null;
  return decodeValue(key, value.value) as UserData[K];
}

export const getUserDatas = <K extends keyof UserData>(keys: K[]) => {
  if (!keys) return null;


  const rows = getMultiStmt.all({ $keys: JSON.stringify(keys) }) as { key: string; value: string }[];

  const result = {};

  for (const row of rows) {
    try {
      result[row.key as keyof UserData] = decodeValue(row.key, row.value);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      writeLogs([{ type: 'error', message: `Failed to parse user data for key=${row.key}: ${message}` }]);
    }
  }

  return result;
}

export function decodeValue(key: string, value: string) {
  if (['repeat', 'shuffle', 'volume'].includes(key)) {
    return Number(value);
  }
  if (['QuitonClose', 'isPlaying', 'isLoading'].includes(key)) {
    return value === '1';
  }
  if (['folder'].includes(key)) {
    return value;
  }
  return JSON.parse(value);
}

export default getUserData