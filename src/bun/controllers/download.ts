import Player, { Audio_format } from "../music/index.ts";
import { Download_item, Status, Track, UserData } from "../../shared/types.ts";
import { getUserDatas } from "../db/index.ts";

export default async function DownloadController(player: Player) {
    const { downloadQueue, folder: download_folder } = getUserDatas(["downloadQueue", "folder"]) as UserData

    player.status = {
        data: Status.idle, track: ""
    };
    player.onStatusChange?.(player.status);

    player.audio_format = Audio_format.m4a;
    player.download_queue = [];

    const track_to_download: Download_item[] = [];
    player.status = {
        data: Status.prepare, track: ""
    }
    player.onStatusChange?.(player.status);
    for (const item of downloadQueue) {
        const [source, mode, id] = item.split(":");
        player.status = {
            data: Status.prepare, track: `${source} - ${mode} - ${id}`
        }
        player.onStatusChange?.(player.status);

        if (source === "youtube") {
            if (mode.includes("track")) {
                const track = (await player.youtube.fetch_track([id]))[0];
                track_to_download.push({
                    id: [track.id],
                    title: track.name,
                    metadata: {
                        artist: track.artist[0].name,
                        year: track.releasedDate,
                        thumbnail: track.thumbnail,
                        source: "youtube"
                    }
                })
            }
            else if (mode.includes("playlist")) {
                const playlist = await player.youtube.fetch_playlist(id);
                playlist.tracks?.forEach((track: Track) => {
                    track_to_download.push({
                        id: [track.id],
                        title: track.name,
                        metadata: {
                            artist: track.artist[0].name,
                            year: track.releasedDate,
                            thumbnail: track.thumbnail,
                            source: "youtube"
                        }
                    })
                })
            }
            else if (mode.includes("artist")) {
                const artist = await player.youtube.fetch_artist(id);
                const playlist = await player.youtube.fetch_playlist(artist.playlistId);
                playlist.tracks?.forEach((track: Track) => {
                    track_to_download.push({
                        id: [track.id],
                        title: track.name,
                        metadata: {
                            artist: track.artist[0].name,
                            year: track.releasedDate,
                            thumbnail: track.thumbnail,
                            source: "youtube"
                        }
                    })
                })
            }
        }
    }

    player.download_queue = track_to_download;
    player.download_folder = download_folder;
    player.status = {
        data: Status.env, track: ""
    }
    player.onStatusChange?.(player.status);
    await player.checking();
    player.download();
    return "ok"
}