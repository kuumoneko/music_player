import type { UserData } from "../../../shared/types.ts";
import db from "../setup.ts"

const writeData = db.prepare(`
  INSERT INTO user_data (key, value)
  VALUES ($key, $value)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
`);

const writeUserData = <K extends keyof UserData>(key: K, data: UserData[K]) => {
  if (!key) return null;
  writeData.run({
    $key: key,
    $value: encodeValue(key, data)
  });
}

export const writeUserDatas = db.transaction((data: Partial<UserData>) => {
  for (const [key, value] of Object.entries(data)) {
    writeData.run({
      $key: key,
      $value: encodeValue(key, value as UserData[keyof UserData])
    });
  }
});

function encodeValue(key: string, data: unknown): string {
  if (['repeat', 'shuffle', 'volume'].includes(key)) {
    return String(Number(data));
  }
  if (['QuitonClose', 'isPlaying', 'isLoading'].includes(key)) {
    return data ? "1" : "0";
  }
  if (['folder'].includes(key)) {
    return String(data);
  }
  return JSON.stringify(data);
}

export default writeUserData