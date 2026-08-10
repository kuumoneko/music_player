import type { SearchResult } from "../../../shared/types.ts";
import db from "../setup.ts";

const SEARCH_TTL_MS = 24 * 60 * 60 * 1000;

const getSearchCacheStmt = db.prepare(`
  SELECT data, fetched_at
  FROM search_cache
  WHERE search_key = ?;
`);

const purgeSearchCacheStmt = db.prepare(`
  DELETE FROM search_cache
  WHERE fetched_at < ?;
`);

export function getSearchCache(key: string): SearchResult | null {
  const row = getSearchCacheStmt.get(key) as { data: string; fetched_at: number } | null;
  if (!row) return null;
  if (Date.now() - row.fetched_at > SEARCH_TTL_MS) return null;
  try {
    return JSON.parse(row.data) as SearchResult;
  } catch {
    return null;
  }
}

export function purgeExpiredSearchCache(): number {
  const info = purgeSearchCacheStmt.run(Date.now() - SEARCH_TTL_MS);
  return Number(info.changes ?? 0);
}

export default getSearchCache;
