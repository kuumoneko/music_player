import type { Track } from "../../shared/types.ts";

const pathToHash = new Map<string, string>();
const hashToPath = new Map<string, string>();

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
  return hashToPath.get(id) ?? id;
}

export function trackToFront(track: Track): Track {
  return { ...track, id: getHash(track.id) };
}

export function tracksToFront(tracks: Track[]): Track[] {
  return tracks.map(trackToFront);
}
