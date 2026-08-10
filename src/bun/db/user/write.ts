import type { UserData } from "../../../shared/types.ts";
import db from "../setup.ts"
import { encodeValue } from "./shared/utils.ts";

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

export default writeUserData