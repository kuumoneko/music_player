import { MusicSource, MusicType, SearchResult } from "../../shared/types";
import Player from "../music";
import { searchLocalFiles } from "../db/index.ts";

export default async function SearchController(player: Player, source: MusicSource, type: MusicType, query: string): Promise<SearchResult> {
    let result = null;
    if (!type || !source) {
        throw new Error("Missing type or source");
    }

    if (!Object.values(MusicType).includes(type)) {
        throw new Error(`Invalid search type: ${type}`);
    }
    if (!query || typeof query !== "string") {
        throw new Error("Search query is required");
    }

    if (query.length < 1 || type.length < 1 || source.length < 1) {
        throw new Error("Invalid query, type or source");
    }

    if (query.length > 200) {
        throw new Error("Search query exceeds maximum length");
    }

    const sanitized = query.replace(/[\x00-\x1f]/g, "").trim();

    if (sanitized.length === 0) {
        throw new Error("Search query is empty after sanitization");
    }
    else if (source === MusicSource.Youtube) {
        result = await player.youtubeDataAPI.search(query, type);
    }
    else if (source === MusicSource.Local) {
        if (type === MusicType.Track) {
            const tracks = searchLocalFiles(sanitized);
            result = { tracks, playlists: [], artists: [] };
        } else {
            result = { tracks: [], playlists: [], artists: [] };
        }
    }
    else {
        throw new Error("Unavailable")
    }

    return result ?? {
        tracks: [],
        playlists: [],
        artists: [],
    };
}