import { getDataFromDatabase } from "../lib/database";
import wait_for_downloader from "../lib/player";
import Player, { Audio_format } from "../music/index.ts";
import { Download_item, Status, Track } from "../types";

export default async function DownloadController(player: Player) {
    await wait_for_downloader(player);
    const folder = player.folder;

    const { download, folder: download_folder } = getDataFromDatabase(folder, "data", "profile");
    const download_queue = download;
    if (download_queue.length === 0) {
        return "No download queue";
    }
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
    for (const item of download_queue) {
        const { source, mode, id } = item;
        player.status = {
            data: Status.prepare, track: `${source} - ${mode} - ${id}`
        }

        if (source === "spotify") {
            if (mode.includes("track")) {
                const data = await player.spotify.fetch_track([id]);
                const track = data[0];
                const ids: string[] = [track.id]
                if (track.matched) {
                    ids.push(track.matched)
                }
                track_to_download.push({
                    id: ids,
                    title: track.name,
                    metadata: {
                        artist: track.artist[0].name,
                        year: track.releasedDate,
                        thumbnail: track.thumbnail,
                        source: "spotify"
                    }
                })
            }
            else if (mode.includes("playlist")) {
                const playlist = await player.spotify.fetch_playlist(id);
                playlist.tracks?.forEach((track: Track) => {
                    const ids: string[] = [track.id]
                    if (track.matched) {
                        ids.push(track.matched)
                    }
                    track_to_download.push({
                        id: ids,
                        title: track.name,
                        metadata: {
                            artist: track.artist[0].name,
                            year: track.releasedDate,
                            thumbnail: track.thumbnail,
                            source: "spotify"
                        }
                    })
                })
            }
            else if (mode.includes("album")) {
                const album = (await player.spotify.fetch_album([id]))[0];
                album.tracks?.forEach((track: Track) => {
                    const ids: string[] = [track.id]
                    if (track.matched) {
                        ids.push(track.matched)
                    }
                    track_to_download.push({
                        id: ids,
                        title: track.name,
                        metadata: {
                            artist: track.artist[0].name,
                            year: track.releasedDate,
                            thumbnail: track.thumbnail,
                            source: "spotify"
                        }
                    })
                })
            }
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

    console.log("--------------------- READY ---------------------")
    player.download_queue = track_to_download;
    player.download_folder = download_folder;
    player.status = {
        data: Status.env, track: ""
    }
    console.log("---------------------- CHECKING ----------------------");
    console.log(download_queue)
    await player.checking();
    player.download();
    console.log("---------------------- DOWNLOADING ----------------------")
    return "ok"
}