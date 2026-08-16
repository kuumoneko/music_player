import { MusicSource, MusicType } from "../../shared/types.ts";

// Validates a context entry string like "youtube:artist:UC..." or "local:local:<id>".
// Invalid entries (e.g. a video id passed as an artist id) make the queue refill
// fail and silently kill auto-advance, so they are dropped instead of poisoning
// every session.
export function isValidContextEntry(entry: string | null | undefined): boolean {
    if (!entry) return true;
    const parts = entry.split(":");
    if (parts.length !== 3 || parts.some(p => p.length === 0)) return false;
    const [source, type, id] = parts;
    if (source === MusicSource.Local) return true;
    if (source !== MusicSource.Youtube) return false;
    if (type === MusicType.Track) return /^[\w-]{11}$/.test(id);
    if (type === MusicType.Artist) {
        return id.startsWith("UC") || id.startsWith("UU") || id.startsWith("@");
    }
    if (type === MusicType.Playlist) {
        return id.startsWith("PL") || id.startsWith("OLAK5uy_") || id.startsWith("UU") || id.startsWith("RD") || id.startsWith("VL");
    }
    return false;
}