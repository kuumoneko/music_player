import type { UserData } from "../../../shared/types.ts";
import db from "../setup.ts"

const getData = db.prepare(`
  SELECT 
    t.key, t.value
  FROM user_data t
  WHERE t.key = ?;
`);

const getUserData = <K extends keyof UserData>(key: K) => {
  if (!key) return null;

  let result: any = null;
  const value = getData.get(key) as any;
  if (value === null || value === undefined) return null;
  if (['repeat', 'shuffle', 'volume'].includes(key)) {
    result = Number(value.value)
  }
  else if (['QuitonClose', 'isPlaying', 'isLoading'].includes(key)) {
    result = value.value === '1' ? true : false
  }
  else if (['folder'].includes(key)) {
    result = value.value;
  }
  else {
    result = JSON.parse(value.value)
  }
  return result as UserData[K]
}

export const getUserDatas = <K extends keyof UserData>(keys: K[]) => {
  if (!keys) return null;

  const getMultiStmt = db.prepare(`
  SELECT key, value 
  FROM user_data 
  WHERE key IN (SELECT value FROM json_each($keys));
`);

  const rows = getMultiStmt.all({ $keys: JSON.stringify(keys) }) as { key: string; value: string }[];

  const result: any = {};

  for (const row of rows) {
    try {
      if (['repeat', 'shuffle', 'volume'].includes(row.key)) {
        result[row.key as keyof UserData] = Number(row.value)
      }
      else if (['QuitonClose', 'isPlaying', 'isLoading'].includes(row.key)) {
        result[row.key as keyof UserData] = row.value === '1' ? true : false
      }
      else {
        result[row.key as keyof UserData] = JSON.parse(row.value)
      }
    } catch (err) {
      console.error(`Error parsing key "${row.key}":`, err);
    }
  }

  return result;
}

export default getUserData