import Player, { AudioFormat } from "../music/index.ts";
import { DownloadItem, MusicSource, MusicType, Status, Track } from "../../shared/types.ts";
import { getUserDatas, writeLogs } from "../db/index.ts";

export default async function DownloadController(player: Player) {
    const { downloadQueue, folder: downloadFolder } = getUserDatas(["downloadQueue", "folder"])

    player.status = {
        data: Status.idle, track: ""
    };
    player.onStatusChange?.(player.status);

    player.audioFormat = AudioFormat.m4a;
    player.downloadQueue = [];

    const tracksToDownload: DownloadItem[] = [];
    player.status = {
        data: Status.prepare, track: ""
    }
    player.onStatusChange?.(player.status);
    for (const item of downloadQueue) {
        const [source, type, id] = item.split(":");
        player.status = {
            data: Status.prepare, track: `${source} - ${type} - ${id}`
        }
        player.onStatusChange?.(player.status);

        if (source === MusicSource.Youtube) {
            if (type === MusicType.Track) {
                const tracks = await player.youtubeDataAPI.fetchTrack([id])
                if (tracks === null || tracks === undefined) { continue; }
                const track = tracks[0];
                tracksToDownload.push({
                    id: [track.id],
                    title: track.name,
                    metadata: {
                        artist: track.artist[0].name,
                        year: track.releasedDate,
                        thumbnail: track.thumbnail,
                        source: MusicSource.Youtube
                    }
                })
            }
            else if (type === MusicType.Playlist) {
                const playlist = await player.youtubeDataAPI.fetchPlaylist(id);
                playlist?.tracks?.forEach((track: Track) => {
                    tracksToDownload.push({
                        id: [track.id],
                        title: track.name,
                        metadata: {
                            artist: track.artist[0].name,
                            year: track.releasedDate,
                            thumbnail: track.thumbnail,
                            source: MusicSource.Youtube
                        }
                    })
                })
            }
            else if (type === MusicType.Artist) {
                const artist = await player.youtubeDataAPI.fetchArtist(id);
                if (artist === null || artist === undefined) continue;
                const playlist = await player.youtubeDataAPI.fetchPlaylist(artist?.playlistId);
                playlist?.tracks?.forEach((track: Track) => {
                    tracksToDownload.push({
                        id: [track.id],
                        title: track.name,
                        metadata: {
                            artist: track.artist[0].name,
                            year: track.releasedDate,
                            thumbnail: track.thumbnail,
                            source: MusicSource.Youtube
                        }
                    })
                })
            }
        }
    }

    player.downloadQueue = tracksToDownload;
    player.downloadFolder = downloadFolder;
    player.status = {
        data: Status.env, track: ""
    }
    player.onStatusChange?.(player.status);
    await player.checking();
    player.download().catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        writeLogs([{ type: "error", message: `Download failed: ${message}` }]);
        player.status = { data: Status.error, track: message };
        player.onStatusChange?.(player.status);
    });
    return "ok"
}