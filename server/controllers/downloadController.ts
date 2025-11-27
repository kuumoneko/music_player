import { Response } from "express";
import {  CustomRequest, Download_item,  Status, Track } from "../types/index.ts";
import { getDataFromDatabase } from "../lib/database.ts";
import { Audio_format } from "../music/index.ts";

export const get = async (req: CustomRequest, res: Response) => {
    try {
        const player = req.player;
        const folder = player.folder;
        const { download, folder: download_folder } = getDataFromDatabase(folder, "data", "profile");
        const download_queue = download;
        if (download_queue.length === 0) {
            return res.status(204).json()
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
            console.log(source, ' ', mode, ' ', id);
            player.status = {
                data: Status.prepare, track: `${source} - ${mode} - ${id}`
            }

            if (source === "spotify") {
                if (mode === "track") {
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
                else if (mode === "playlist") {
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
                else if (mode === "album") {
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
                if (mode === "track") {
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
                else if (mode === "playlist") {
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
        res.status(204).json()
    }
    catch (e) {
        console.error(e);
        res.status(500).json({
            message: e
        })
    }
}

export const download_status = (req: CustomRequest, res: Response) => {
    const player = req.player;
    const status = player.status;
    res.status(200).json({
        data: status
    })
}