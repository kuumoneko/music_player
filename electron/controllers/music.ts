import Player from "../music/index.ts"
import wait_for_downloader from '../lib/player';
export default async function MusicController(player: Player, data: any) {
    const { source, mode, type, id, query }: {
        source: string,
        mode: string,
        type: string,
        id: string,
        query: string
    } = data;
    await wait_for_downloader(player);
    let result: any = null;
    if (mode === "search") {
        if (!query || !type || !source) {
            throw new Error("Missing query, type or source");
        }
        if (query.length < 0 || type.length < 0 || source.length < 0) {
            throw new Error("Invalid query, type or source");
        }
        if (source === "spotify") {
            result = await player.spotify.search(query as string, type as any);
        }
        else if (source === "youtube") {
            result = await player.youtube.search(query as string, type as any);
        }
    }
    else {
        if (!id || !type || !source) {
            throw new Error("Missing id, type or source");
        }
        if (!["spotify", "youtube", "local"].includes(source)) {
            throw new Error("Invalid source");
        }
        if (!["tracks", "playlists", "artists", "albums", "local"].includes(type)) {
            throw new Error("Invalid type");
        }
        if (source === "spotify") {
            if (type === "tracks") {
                result = await player.spotify.fetch_track(typeof id === "string" ? [id] : id);
            }
            else if (type === "playlists") {
                result = await player.spotify.fetch_playlist(id);
            }
            else if (type === "artists") {
                result = await player.spotify.fetch_artist(id);
            }
            else if (type === "albums") {
                result = await player.spotify.fetch_album(typeof id === "string" ? [id] : id);
            }
        }
        else if (source === "youtube") {
            if (type === "tracks") {
                result = await player.youtube.fetch_track(typeof id === "string" ? [id] : id);
            }
            else if (type === "playlists") {
                result = await player.youtube.fetch_playlist(id);
            }
            else if (type === "artists") {
                result = await player.youtube.fetch_artist(id);
            }
        }
        else if (
            source === "local"
        ) {
            try {
                result = {
                    tracks: player.local.data
                };
            } catch (error: any) {
                if (error.code === "ENOENT") {
                    throw new Error("Folder not found");
                }
            }
        }
    }
    return result;
}