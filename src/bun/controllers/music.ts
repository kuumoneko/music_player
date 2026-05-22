import { getAllLocalFiles, writeLogs } from "../db/index.ts";
import Player from "../music/index.ts"
export default async function MusicController(player: Player, data: { source, mode, type, id, query }) {
    const { source, mode, type, id, query }: {
        source: string,
        mode: string,
        type: "" | "video" | "playlist" | "artist",
        id: string,
        query: string
    } = data;
    if (!player) throw new Error("Player is null.")
    let result = null;
    if (mode === "search") {
        if (!query || !type || !source) {
            throw new Error("Missing query, type or source");
        }
        if (query.length < 1 || type.length < 1 || source.length < 1) {
            throw new Error("Invalid query, type or source");
        }
        else if (source === "youtube") {
            result = await player.youtube.search(query as string, type);
        }
    }
    else {
        if (!id || !type || !source) {
            throw new Error("Missing id, type or source");
        }
        if (!["youtube", "local"].includes(source)) {
            throw new Error("Invalid source");
        }
        if (!["tracks", "playlists", "artists", "local"].includes(type)) {
            throw new Error("Invalid type");
        }
        else if (source === "youtube") {
            if (type === "video" || type.includes("track")) {
                const temp = await player.youtube.fetch_track(typeof id === "string" ? [id] : id)
                result = {
                    tracks: temp,
                    ...temp[0]
                }
            }
            else if (type.includes("playlist")) {
                result = await player.youtube.fetch_playlist(id);
            }
            else if (type.includes('artist')) {
                result = await player.youtube.fetch_artist(id);
            }
        }
        else if (
            source === "local"
        ) {
            try {
                const localFiles = getAllLocalFiles()
                result = {
                    tracks: localFiles
                };
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                writeLogs([{ type: "error", message: message }]);
            }
        }
    }
    return result;
}