import Player, { Audio_format } from "../music/index.ts";
import { Download_item, Status, Track } from "../../shared/types.ts";
import { getUserDatas } from "../db/index.ts";

export default async function DownloadController(player: Player) {
    const { downloadQueue, folder: download_folder } = getUserDatas(["downloadQueue", "folder"])

    player.status = {
        data: Status.idle, track: ""
    };

    player.audio_format = Audio_format.m4a;
    player.download_queue = [];

    const track_to_download: Download_item[] = [];
    console.log(new Array(30).fill("-").join(""));
    player.status = {
        data: Status.prepare, track: ""
    }
    for (const item of downloadQueue) {
        const { source, mode, id } = item;
        player.status = {
            data: Status.prepare, track: `${source} - ${mode} - ${id}`
        }

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
        }
    }

    console.log("---------------------- READY ---------------------")
    player.download_queue = track_to_download;
    player.download_folder = download_folder;
    player.status = {
        data: Status.env, track: ""
    }
    console.log("---------------------- CHECKING ----------------------");
    await player.checking();
    player.download();
    console.log("---------------------- DOWNLOADING ----------------------")
    return "ok"
}