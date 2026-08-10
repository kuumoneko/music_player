import { MusicSource, MusicType } from "../../shared/types.ts";
import { getAllLocalFiles, writeLogs, getPlaylist } from "../db/index.ts";
import { tracksToFront } from "../lib/hash.ts";
import Player from "../music/index.ts"
export default async function MusicController(player: Player, source: MusicSource, type: MusicType, id: string) {
    if (!player) throw new Error("Player is null.")
    let result = null;
    if (!id || !type || !source || id.length < 1) {
        throw new Error("Missing id, type or source");
    }

    if (!Object.values(MusicSource).includes(source)) {
        throw new Error("Invalid source");
    }

    if (!Object.values(MusicType).includes(type)) {
        throw new Error("Invalid type");
    }

    if (source === MusicSource.Youtube) {
        if (type === MusicType.Track) {
            const tracks = await player.youtubeDataAPI.fetchTrack([id]);
            result = tracks?.[0] ?? null;
        }
        else if (type === MusicType.Playlist) {
            result = await player.youtubeDataAPI.fetchPlaylist(id);
        }
        else if (type === MusicType.Artist) {
            result = await player.youtubeDataAPI.fetchArtist(id);
        }
    }
    else if (source === MusicSource.Local) {
        if (type === MusicType.Playlist) {
            result = getPlaylist(id, true);
        } else {
            try {
                const localFiles = getAllLocalFiles()
                result = {
                    tracks: tracksToFront(localFiles)
                };
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                writeLogs([{ type: "error", message: message }]);
            }
        }
    }
    return result;
}