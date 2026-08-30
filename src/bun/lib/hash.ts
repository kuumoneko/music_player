import type { Track } from "../../shared/types.ts";
import { getAllLocalFileIds } from "../db/index.ts";

const pathToHash = new Map<string, string>();
const hashToPath = new Map<string, string>();
let populated = false;

export function getHash(filePath: string): string {
  let h = pathToHash.get(filePath);
  if (!h) {
    h = Bun.hash(filePath).toString(16);
    pathToHash.set(filePath, h);
    hashToPath.set(h, filePath);
  }
  return h;
}

export function getPath(hash: string): string | undefined {
  return hashToPath.get(hash);
}

export function resolveId(id: string): string {
  if (hashToPath.has(id)) return hashToPath.get(id)!;
  if (!populated) {
    ensurePopulated();
    return hashToPath.get(id) ?? id;
  }
  return id;
}

export function trackToFront(track: Track): Track {
  return { ...track, id: getHash(track.id) };
}

export function tracksToFront(tracks: Track[]): Track[] {
  return tracks.map(trackToFront);
}

export function ensurePopulated(): void {
  if (populated) return;
  populated = true;
  const ids = getAllLocalFileIds();
  for (const id of ids) {
    getHash(id);
  }
}

export function clearHashes(): void {
  pathToHash.clear();
  hashToPath.clear();
  populated = false;
}
