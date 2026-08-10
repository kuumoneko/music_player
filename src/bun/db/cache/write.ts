import type { SearchResult } from "../../../shared/types.ts";
import db from "../setup.ts";

const upsertSearchCacheStmt = db.prepare(`
  INSERT INTO search_cache (search_key, data, fetched_at)
  VALUES ($key, $data, $fetchedAt)
  ON CONFLICT(search_key) DO UPDATE SET
    data = excluded.data,
    fetched_at = excluded.fetched_at;
`);

export function setSearchCache(key: string, result: SearchResult) {
  upsertSearchCacheStmt.run({
    $key: key,
    $data: JSON.stringify(result),
    $fetchedAt: Date.now(),
  });
}

export default setSearchCache;
