import type { UserData } from "../../../shared/types.ts";
import db from "../setup.ts"

const writeData = db.prepare(`
  INSERT INTO user_data (key, value)
  VALUES ($key, $value)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
`);

const writeUserData = <K extends keyof UserData>(key: K, data: any) => {
  if (!key) return null;

  let result: any = null;
  if (['repeat', 'shuffle', 'volume'].includes(key)) {
    result = Number(data)
  }
  else if (['QuitonClose', 'isPlaying', 'isLoading'].includes(key)) {
    result = data ? "1" : "0"
  }
  else if (['folder'].includes(key)) {
    result = data;
  }
  else {
    result = JSON.stringify(data)
  }
  writeData.run({
    $key: key,
    $value: result
  });
}

export const writeUserDatas = db.transaction((data: Partial<UserData>) => {
  for (const [key, value] of Object.entries(data)) {
    writeData.run({
      $key: key,
      $value: JSON.stringify(value)
    });
  }
});

export default writeUserData