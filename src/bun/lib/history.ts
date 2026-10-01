import { getUserData, writeUserData } from "../db/index.ts";

const HISTORY_LIMIT = 100;

export function recordPlayed(id: string): string[] {
    const history = getUserData("playedTrack") ?? [];
    if (!id) return history;
    const next = Array.from(new Set([...history.filter((t: string) => t !== id), id])).slice(-HISTORY_LIMIT);
    writeUserData("playedTrack", next);
    return next;
}
