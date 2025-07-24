// ts-nocheck

// server
import express from "express";
import cors from 'cors';
import path from 'node:path';
import fs, { readFileSync, writeFileSync } from 'node:fs';
import * as mm from 'music-metadata';

// downloader
import Downloader from './downloader/index.ts';
import { Audio_format, Playlist, Status, Track } from "./downloader/music/types.ts";
import { getDataFromDatabase, writeDataToDatabase } from "./dist/function.ts";
import { Server_mode } from "./types.ts";



export async function server(executableDir: string, downloader: Downloader, mode: string) {



    // const openUrlInBrowser = (url: string) => {
    //     const platform = process.platform;

    //     let command;
    //     switch (platform) {
    //         case 'darwin': // macOS
    //             command = `open ${url}`;
    //             break;
    //         case 'win32': // Windows
    //             command = `start ${url}`;
    //             break;
    //         case 'linux': // Linux
    //             // xdg-open is the standard on most Linux desktop environments
    //             command = `xdg-open ${url}`;
    //             break;
    //         default:
    //             console.error(`Unsupported platform: ${platform}`);
    //             return;
    //     }

    //     exec(command, (error, stdout, stderr) => {
    //         if (error) {
    //             console.error(`Failed to open URL: ${error.message}`);
    //             return;
    //         }
    //         if (stderr) {
    //             console.error(`Error during command execution: ${stderr}`);
    //             return;
    //         }
    //         console.log(`Successfully opened ${url} in your default browser.`);
    //     });
    // }

    // --- Main Application Start ---

    try {
        // --- System Initialization ---
        const system = getDataFromDatabase(executableDir, "data", "system");
        const origin = system["server_link"] || "*"; // Fallback to allow all origins if not set
        const port = Number(system["port"] as string) || 3001;

        // --- Express App Setup ---
        const app = express();
        const corsOptions = {
            origin: origin,
            methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
            credentials: true,
        };

        app.use(cors(corsOptions));
        app.use(express.json());


        // --- Back End functino ---

        const generateRandomString = (length: number) => {
            const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
            const values = crypto.getRandomValues(new Uint8Array(length));
            return values.reduce((acc, x) => acc + possible[x % possible.length], "");
        }

        setInterval(() => {
            async function run() {
                const data = getDataFromDatabase(executableDir, "data", "user");

                let res: any = {
                    youtube: data.youtube,
                    spotify: data.spotify,
                    local: data.local
                }

                // console.log(data?.youtube?.expires, ' ', data?.spotify?.expires, ' ', new Date().getTime());

                // const now = new Date().getTime();
                let lmao = false;

                if (data.youtube.expires && data.youtube.expires <= new Date().getTime()) {
                    lmao = true;
                    const Youtube = await downloader.music.youtube.refreshYoutubeToken(data.youtube.refresh_token) as any;
                    if (Youtube) {
                        const user = await downloader.music.youtube.fetch_youtube_user(Youtube.access_token);

                        res.youtube = {
                            access_token: Youtube.access_token,
                            expires: Youtube.expires,
                            refresh_token_expires: Youtube.refresh_token_expires_in,
                            refresh_token: res.youtube.refresh_token,
                            user: user

                        }
                    }
                    // console.log("youtube: ", Youtube)
                }

                if (data.spotify.expires && data.spotify.expires <= new Date().getTime()) {
                    lmao = true
                    const spotifyUser = await downloader.music.spotify.refreshSpotifyToken(data.spotify.refresh_token) as any;
                    if (spotifyUser) {
                        const user = await downloader.music.spotify.getme(spotifyUser.access_token);
                        res.spotify = {
                            access_token: spotifyUser.access_token,
                            expires: spotifyUser.expires,
                            refresh_token: spotifyUser.refresh_token ? spotifyUser.refresh_token : data.spotify.refresh_token,
                            user: user
                        }
                    }
                    // console.log("spotify: ", spotifyUser)

                }

                if (lmao) {
                    writeDataToDatabase(executableDir, "data", "user", res)
                    downloader = new Downloader({
                        ytdlp: downloader.ytdlp,
                        spotdlp: downloader.spotdlp,
                        ffmpeg: downloader.ffmpeg,
                        download_folder: downloader.folder,
                        curr_folder: downloader.curr_folder,
                        spot_errors: path.join(executableDir, 'BE', 'spot.txt'),
                        audio_format: downloader.audio_format as Audio_format,
                        youtube_api_key: system.Youtube_Api_key,
                        google_client_id: system.web.client_id,
                        google_client_secret: system.web.client_secret,
                        redirect_uris: system.web.redirect_uris,
                        spotify_api_key: system.Spotify_Api_key,
                        spotify_client: system.Spotify_client
                    }, downloader.mode)
                }
            }
            run();
        }, 1000);

        // setInterval(() => {
        //     async function run() {
        //         const { youtube, spotify } = getDataFromDatabase(executableDir, "data", "track");

        //         // get all keys of youtue
        //         const youtube_keys = Object.keys(youtube);
        //         const spotify_keys = Object.keys(spotify);

        //         let tracks: any[] = []

        //         for (const key of youtube_keys) {
        //             if (youtube[key].music_url === null) {
        //                 tracks.push({
        //                     id: youtube[key].track.id
        //                 })

        //                 // youtube[key].music_url = track;
        //             }
        //         }

        //         if (tracks.length > 0) {
        //             writeFileSync(`${executableDir}\\BE\\data.txt`, tracks.map((item: any) => item.id).join("\n"))
        //             // writeDataToDatabase(executableDir, "data", "data", tracks.map((item: any) => item.id).join("\n"))

        //             const track = await downloader.getAudioURLAlternative("", `${executableDir}\\BE\\data.txt`);

        //             console.log(track)
        //         }

        //         // tracks = []

        //         // for (const key of spotify_keys) {

        //         //     if (spotify[key].music_url === null) {
        //         //         const track = await downloader.music.spotify.fetchTrackVideos_spotify(spotify[key].track.id);
        //         //         const findYtbTrack = await downloader.music.youtube.findMatchingVideo(track)

        //         //         tracks.push({
        //         //             id: spotify[key].track.id,
        //         //             url: `https://www.youtube.com/watch?v=${findYtbTrack?.track.id}&rco=1`
        //         //         })


        //         //     }

        //         // }

        //         // if (tracks.length > 0) {
        //         //     const track = await downloader.getAudioURLAlternative(tracks);

        //         // }
        //         writeDataToDatabase(executableDir, "data", "track", {
        //             youtube,
        //             spotify
        //         })

        //     }
        //     run();
        // }, 1000);



        // --- API Routes ---
        app.post("/download", async (req, res) => {
            try {
                const { format, links }: {
                    format: string,
                    links: [{ source: string, mode: string, id: string }]
                } = req.body;

                if (!links || links.length as number === 0) {
                    return res.status(400).json({ message: "No links provided." });
                }

                downloader.set_audio_format(format as Audio_format);
                downloader.clear_links();

                for (const link of links) {
                    if (link.source === "youtube") {
                        await downloader.add_link(`https://www.youtube.com/${link.mode}?${link.mode === "watch" ? "v" : "list"}=${link.id}`);
                    } else if (link.source === "spotify") {
                        await downloader.add_link(`https://open.spotify.com/${link.mode}/${link.id}`);
                    }
                }
                await downloader.checking();
                const { local } = getDataFromDatabase(executableDir, "data", "user");
                console.log(local.folder);
                if (local.folder !== "" && local.folder !== undefined && local.folder !== null) {
                    downloader.set_download_foler(local.folder)
                }
                downloader.download(""); // This is non-blocking, which is correct for your status polling
                return res.status(202).json({ message: "Download process started." }); // 202 Accepted is more appropriate
            } catch (error) {
                console.error("Error in /download endpoint:", error);
                return res.status(500).json({ message: "Internal server error while create downloading state" });
            }
        });

        app.get("/download_status", async (req, res) => {
            try {
                const status = await downloader.get_status();
                return res.status(200).json({ message: "OK", status: status.status || Status.idle });
            } catch (error) {
                console.error("Error in /download_status endpoint:", error);
                return res.status(500).json({ message: "Internal server error while getting downloaded status" });
            }
        });

        app.get("/search/:query/:where", async (req, res) => {
            const query: string = req.params.query;
            const where: string = req.params.where || "";
            try {
                const result = await downloader.music.search(query, where);
                return res.status(200).json(result);
            }
            catch (e) {
                console.error(e);
                return res.status(500).json({
                    message: "Internal server error while searching"
                })
            }
        })


        app.get("/user", (req, res) => {
            const data = getDataFromDatabase(executableDir, "data", "user");
            // console.log(data);

            return res.status(200).json({
                youtube: data.youtube.access_token ? data.youtube.user : false,
                spotify: data.spotify.access_token ? data.spotify.user : false
            })
        })

        app.get("/logout/:where", (req, res) => {
            const where = req.params.where;
            const user = getDataFromDatabase(executableDir, "data", "user");

            try {
                if (where === "youtube") {
                    writeDataToDatabase(executableDir, "data", "user", {
                        youtube: {
                            refresh_token: null,
                            access_token: null,
                            expires: null
                        },
                        spotify: user.spotify,
                        local: user.local
                    })
                }
                else {
                    writeDataToDatabase(executableDir, "data", "user", {
                        spotify: {
                            id: null,
                            refresh_token: null,
                            access_token: null,
                            expires: null
                        },
                        youtube: user.youtube,
                        local: user.local
                    })
                }
                return res.status(200).json({
                    message: "ok"
                })
            }
            catch (e) {
                return res.status(500).json({
                    message: `Internal server error while logging out with ${where}`
                })
            }
        })

        app.get("/login/:where", (req, res) => {
            const where = req.params.where;
            let authUrl: string = "";
            const redirectUri = `http://localhost:${(mode === Server_mode.server) ? 3001 : 3000}`

            try {
                if (where === "youtube") {
                    authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${system.web.client_id}&redirect_uri=${encodeURIComponent(
                        redirectUri
                    )}&response_type=code&scope=https://www.googleapis.com/auth/youtube.readonly&state=${generateRandomString(4)}&prompt=consent&access_type=offline`
                }
                else {
                    authUrl = `https://accounts.spotify.com/authorize?client_id=${system.Spotify_client}&response_type=code&redirect_uri=${encodeURIComponent(
                        redirectUri
                    )}&scope=${encodeURIComponent([
                        'user-read-private',
                        'user-read-email',
                        'playlist-modify-public',
                        'user-library-read'
                    ].join(' '))}&state=${generateRandomString(16)}`;
                }

                return res.status(200).json({
                    url: authUrl
                })
            }
            catch (e) {
                console.error(e);
                return res.status(500).json({
                    message: `Internal server error while creating login url for ${where}`
                })
            }
        })

        app.post("/auth/:where", async (req, res) => {
            const where = req.params.where;
            const { code } = req.body;

            try {
                const user = getDataFromDatabase(executableDir, "data", "user");
                if (where === "youtube") {
                    const google_token = await downloader.music.youtube.gettoken(code) as any;
                    // console.log(google_token)
                    const googleUser = await downloader.music.youtube.fetch_youtube_user(google_token.access_token);

                    writeDataToDatabase(executableDir, "data", "user", {
                        youtube: {
                            refresh_token: google_token.refresh_token,
                            access_token: google_token.access_token,
                            expires: new Date().getTime() + google_token.expires_in * 1000,
                            user: googleUser
                        },
                        spotify: user.spotify,
                        local: user.local
                    })

                    return res.status(200).json({ user: googleUser })
                }
                else {
                    const spotifyUser = await downloader.music.spotify.verifySpotifyToken(code) as any;

                    writeDataToDatabase(executableDir, "data", "user", {
                        spotify: {
                            id: spotifyUser.user.id,
                            refresh_token: spotifyUser.refresh_token,
                            access_token: spotifyUser.access_token,
                            expires: spotifyUser.expires,
                            user: spotifyUser.user
                        },
                        youtube: user.youtube,
                        local: user.local
                    })

                    return res.status(200).json({ user: spotifyUser.user });
                }
            }
            catch (e) {
                console.error(e)
                return res.status(401).json({ message: 'Invalid ID token' });
            }
        })



        app.get("/download", async (req, res) => {
            try {
                const filePath = downloader.getdownload();
                if (!filePath) {
                    return res.status(404).json({ message: "No download file is ready." });
                }

                res.download(filePath, 'music_download.7z', (err) => {
                    if (err) {
                        // This error often happens if the client aborts the download.
                        // We check if headers were already sent to avoid a crash.
                        if (!res.headersSent) {
                            console.error("Error sending file:", err);
                            return res.status(500).json({ message: "Error sending file." });
                        }
                    }
                });
            } catch (error) {
                console.error("Error in /download (GET) endpoint:", error);
                return res.status(500).json({ message: "Internal server error while getting downloaded file" });
            }
        });

        app.get("/user_playlist", async (req, res) => {
            // const { spotify, youtube }: { spotify: { userid: string, access_token: string }, youtube: string } = req.body;
            const { youtube, spotify }: {
                youtube: {
                    refresh_token: string,
                    access_token: string,
                    expires: number
                },
                spotify: {
                    id: string,
                    refresh_token: string,
                    access_token: string,
                    expires: number
                }
            } = getDataFromDatabase(executableDir, "data", "user");



            const data = getDataFromDatabase(executableDir, "data", "userplaylists");



            try {
                let spotify_playlists: any[] = [], youtube_playlists: any[] = [];

                if (spotify.access_token) {
                    spotify_playlists = (await downloader.music.spotify.fetch_spotify_user_playlists(spotify.id, spotify.access_token) as any).playlists
                }

                if (youtube.access_token) {
                    youtube_playlists = (await downloader.music.youtube.fetch_youtube_user_playlist(youtube.access_token) as any).playlists;
                }

                // console.log(spotify_playlists)

                writeDataToDatabase(executableDir, "data", "userplaylists", {
                    youtube: youtube_playlists.length > 0 ? youtube_playlists : data.youtube,
                    spotify: spotify_playlists.length > 0 ? spotify_playlists : data.spotify
                })

                return res.status(200).json({
                    youtube: youtube_playlists.length > 0 ? youtube_playlists : ["Youtube Account is not connected"],
                    spotify: spotify_playlists.length > 0 ? spotify_playlists : ["Spotify Account is not connected"]
                })
            }

            catch (e) {
                console.error(e);
                return res.status(500).json({
                    message: "Internal server error while getting user playlist",

                })
            }
        })

        app.get("/liked_songs/:where", async (req, res) => {
            const where = req.params.where;;
            const { youtube, spotify }: {
                youtube: {
                    refresh_token: string,
                    access_token: string,
                    expires: number
                },
                spotify: {
                    id: string,
                    refresh_token: string,
                    access_token: string,
                    expires: number
                }
            } = getDataFromDatabase(executableDir, "data", "user");



            try {
                if (where === "youtube") {
                    if (!youtube.access_token) {
                        return res.status(404).json({
                            message: "Youtube Account is not connected"
                        });
                    }

                    const liked_songs = await downloader.music.youtube.fetchLikedVideos(youtube.access_token);
                    res.status(200).json(liked_songs);
                } else {
                    if (!spotify.access_token) {
                        return res.status(404).json({
                            message: "Spotify Account is not connected"
                        });
                    }

                    const liked_songs = await downloader.music.spotify.fetch_spotify_user_saved_playlists(spotify.access_token);
                    return res.status(200).json(liked_songs);
                }
            }
            catch (e) {
                console.log(e)
                return res.status(500).json({
                    message: "Internal server error while getting liked songs"
                })
            }
        })

        app.get("/playlist/:where/:id", async (req, res) => {
            const where = req.params.where;
            const id = req.params.id;
            const { youtube, spotify }: {
                youtube: {
                    refresh_token: string,
                    access_token: string,
                    expires: number
                },
                spotify: {
                    id: string,
                    refresh_token: string,
                    access_token: string,
                    expires: number
                }
            } = getDataFromDatabase(executableDir, "data", "user");

            try {
                const data = getDataFromDatabase(executableDir, "data", "track");

                const usr_ply = getDataFromDatabase(executableDir, "data", "userplaylists");



                if (where === "youtube") {
                    let playlist: Playlist = {
                        type: "",
                        id: "",
                        name: "",
                        thumbnail: "",
                        duration: 0,
                        tracks: []
                    };

                    // console.log(usr_ply.youtube.map((item: any) => item.playlistId).includes(id))
                    if (usr_ply.youtube.map((item: any) => item.playlistId).includes(id)) {
                        if (!youtube.access_token) {
                            return res.status(404).json({
                                message: "Youtube Account is not connected"
                            })
                        }
                        // console.log(youtube.access_token)
                        playlist = await downloader.music.youtube.fetchPlaylistVideos(id, youtube.access_token);

                    }
                    else {
                        playlist = await downloader.music.youtube.fetchPlaylistVideos(id);

                    }





                    const check = playlist.tracks.map((track: any) => {
                        // console.log(data.youtube[track.track.id])
                        return {
                            type: "youtube:track",
                            thumbnail: track.thumbnail,
                            artists: track.artists,
                            track: {
                                name: track.track.name,
                                id: track.track.id,
                                releaseDate: track.track.releaseDate,
                                duration: data.youtube[track.track.id]?.track.duration || null,
                            }
                        }
                    })

                    // console.log(check.filter((track: any) => {
                    //     return track.track.duration === null;
                    // }))

                    const list_of_none_duration = check.filter((track: any) => {
                        return track.track.duration === null;
                    }).map((track: any) => {
                        return track.track.id;
                    })

                    interface A {
                        id: string,
                        duration: number
                    }
                    const list_of_duration: A[] = await downloader.music.youtube.getdurations(list_of_none_duration) as unknown as A[];


                    const ress = check.map((track: any) => {
                        return {
                            type: "youtube:track",
                            thumbnail: track.thumbnail,
                            artists: track.artists,
                            track: {
                                name: track.track.name,
                                id: track.track.id,
                                releaseDate: track.track.releaseDate,
                                duration: track.track.duration ? track.track.duration : list_of_duration.find((item: A) => {
                                    return item.id === track.track.id;
                                })?.duration,
                            }
                        }
                    })

                    ress.forEach((track: any) => {
                        data.youtube[track.track.id] = {
                            thumbnail: track.thumbnail,
                            artists: track.artists,
                            track: {
                                name: track.track.name,
                                id: track.track.id,
                                releaseDate: track.track.releaseDate,
                                duration: track.track.duration ? track.track.duration : list_of_duration.find((item: A) => {
                                    return item.id === track.track.id;
                                })?.duration,
                            },
                            music_url: data.youtube[track.track.id]?.music_url ?? null
                        }
                    })

                    writeDataToDatabase(executableDir, "data", "track", data);



                    return res.status(200).json({
                        type: "youtube:playlist",
                        thumbnail: playlist.thumbnail,
                        name: playlist.name,
                        duration: ress.map((item: any) => item.track.duration).reduce((a: number, b: number) => a + b, 0),
                        id: playlist.id,
                        tracks: ress
                    });
                } else {
                    if (!spotify.access_token) {
                        res.status(404).json({
                            message: "Spotify Account is not connected"
                        })
                    }
                    const playlist = await downloader.music.spotify.fetchPlaylistVideos_spotify(id, spotify.access_token);


                    playlist.tracks.forEach((track: any) => {
                        data.spotify[track.track.id] = {
                            thumbnail: track.thumbnail,
                            artists: track.artists,
                            track: {
                                name: track.track.name,
                                id: track.track.id,
                                releaseDate: track.track.releaseDate,
                                duration: track.track.duration,
                            },
                            music_url: data.youtube[track.track.id] ? data.youtube[track.track.id] : null
                        }
                    })

                    writeDataToDatabase(executableDir, "data", "track", data);


                    return res.status(200).json(playlist);
                }
            }
            catch (e) {
                console.error(e)
                return res.status(400).json({
                    message: "Internal server error while getting playlist items",
                })
            }
        })


        app.get("/track/:where/:id", async (req, res) => {
            const where = req.params.where;;
            const id = req.params.id;

            try {
                const data = getDataFromDatabase(executableDir, "data", "track");

                if (where === "youtube") {
                    if (data.youtube[id]) {
                        const video = data.youtube[id]
                        return res.status(200).json({
                            type: "youtube:track",
                            thumbnail: video.thumbnail || "",
                            artists: video.artists,
                            track: video.track
                        });
                    }
                    const track = await downloader.music.youtube.fetchVideos(id);
                    data.youtube[id] = {
                        thumbnail: track.thumbnail,
                        artists: track.artists,
                        track: track.track,
                        music_url: null
                    };
                    writeDataToDatabase(executableDir, "data", "track", data);
                    return res.status(200).json(track);
                } else {
                    if (data.spotify[id]) {
                        const video = data.spotify[id]

                        return res.status(200).json({
                            type: "spotify:track",
                            thumbnail: video.thumbnail || "",
                            artists: video.artists,
                            track: video.track
                        });
                    }
                    const track = await downloader.music.spotify.fetchTrackVideos_spotify(id);
                    data.spotify[id] = {
                        thumbnail: track.thumbnail,
                        artists: track.artists,
                        track: track.track,
                        music_url: null
                    };
                    writeDataToDatabase(executableDir, "data", "track", data);
                    return res.status(200).json(track);
                }
            }
            catch (e) {
                console.error(e)
                return res.status(400).json({
                    message: "Internal server error while getting track"
                })
            }
        })


        app.post('/stream/:where', async (req, res) => {
            const where = req.params.where;

            const { id, mode } = req.body;
            try {

                if (!id) {
                    return res.status(400).json({
                        message: "Music ID is required"
                    });
                }

                if (!mode) {
                    return res.status(400).json({
                        message: "Music Mode is required"
                    });
                }

                if (where === "local") {

                    const audioBuffer = fs.readFileSync(id);
                    const base64Audio = audioBuffer.toString('base64');


                    return res.status(200).json({
                        url: base64Audio
                    })
                }

                let musicId = "";
                const data = getDataFromDatabase(executableDir, "data", "track");
                const resss = data[where][id]
                // console.log(resss)
                if (data[where][id] && data[where][id]?.music_url !== null) {

                    const ress = await fetch(data[where][id].music_url, {
                        method: "HEAD",
                    })

                    // console.log(ress.status)

                    if (ress.status !== 403) {
                        // console.log(`Link "${data[where][id].music_url}" is OK (Status: ${res.status})`);
                        return res.status(200).json({
                            url: data[where][id].music_url
                        })
                    }
                }

                if (where === "youtube") {
                    musicId = id;
                }
                else {
                    const track = await downloader.music.spotify.fetchTrackVideos_spotify(id);


                    const findYtbTrack = await downloader.music.youtube.findMatchingVideo(track)
                    if (!findYtbTrack) {
                        return res.status(404).json({
                            message: "Music not found"
                        });
                    }

                    musicId = findYtbTrack.track.id;
                }


                const bestAudio = await downloader.getAudioURLAlternative(musicId)

                data[where][id] = {
                    ...data[where][id],
                    music_url: bestAudio
                }

                writeDataToDatabase(executableDir, "data", "track", data)

                // Send the URL of the best audio format
                return res.status(200).json({ url: bestAudio });
            } catch (error) {
                console.error('Error fetching audio stream:', error);
                return res.status(500).send('Internal server error while getting stream url');
            }
        });

        app.post("/localfile", (req, res) => {
            const { location } = req.body;

            if (!location || typeof location !== 'string') {
                return res.status(400).json({ message: "A valid file path 'location' is required." });
            }

            try {

                // console.log(location);

                try {
                    const stats = fs.statSync(location);
                    if (stats.isDirectory()) {
                        // console.log(`Folder exists at: ${location}`);

                        const data = getDataFromDatabase(executableDir, "data", "user");

                        writeDataToDatabase(executableDir, "data", "user", {
                            spotify: data.spotify,
                            youtube: data.youtube,
                            local: {
                                folder: location
                            }
                        })
                        downloader.set_download_foler(location)
                        return res.status(200).json({ folder: location });

                    } else {
                        return res.status(400).json({ message: "It is not folder" });

                    }
                }
                catch (e: any) {
                    if (e.code === "ENOENT") {
                        // console.log("Folder is not existed")
                        return res.status(404).json({ message: "Folder not found" });

                    }
                }

            } catch (error: any) {
                console.error(`Error processing path '${location}':`, error);
                return res.status(500).json({ message: "Internal server error while processing the path." });
            }
        });

        app.get("/local", async (req, res) => {
            try {
                const { local } = getDataFromDatabase(executableDir, "data", "user");

                if (!local || !local.folder) {
                    return res.status(400).json({ message: "Local music folder not set." });
                }

                const locall = JSON.parse(readFileSync(`${executableDir}\\BE\\localfile\\local.json`, { encoding: "utf-8" }) as string)

                const folderPath = local.folder;
                const dirents = await fs.promises.readdir(folderPath, { withFileTypes: true });
                const audioExtensions = ['.mp3', '.wav', '.flac', '.m4a', '.ogg', '.aac'];

                const files: any[] = locall || [];

                const audiofiles = dirents.filter(dirent => dirent.isFile() && audioExtensions.includes(path.extname(dirent.name).toLowerCase()))

                const difer = audiofiles.filter((dirent: fs.Dirent) =>
                    !locall.find((item: any) => {
                        return item.track.id === `${folderPath}\\${dirent.name}`
                    })
                )

                // console.log(difer)

                if (difer.length === 0) {
                    return res.status(200).json({
                        type: "local:folder",
                        name: path.basename(folderPath),
                        path: folderPath,
                        tracks: locall,
                    })
                }

                // const a: any[] = [];

                for (const dirent of difer) {
                    const filePath = path.join(folderPath, dirent.name);
                    try {
                        const metadata = await mm.parseFile(filePath);
                        const picture = metadata.common.picture?.[0];
                        // Convert the thumbnail image buffer to a base64 data URL for easy use in the frontend

                        const dataa: number[] = picture?.data.toString().split(",").map((item: any) => Number(item)) as number[];

                        const buffer = Buffer.from(dataa);
                        const base64 = buffer.toString("base64");

                        const thumbnail = picture ? `data:${picture.format};base64,${base64}` : null;
                        // console.log(metadata.common)

                        function formatDate(dateStr: string) {
                            if (!/^\d{8}$/.test(dateStr)) {
                                throw new Error('Input must be exactly 8 digits');
                            }
                            return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6)}`;
                        }

                        files.push({
                            type: "local:track", // Added for consistency with your other data types
                            track: {
                                name: metadata.common.title || path.basename(dirent.name, path.extname(dirent.name)),
                                filename: dirent.name,
                                id: `${folderPath}\\${dirent.name}`,
                                path: filePath,
                                duration: (metadata.format.duration || 0) * 1000,
                                releaseDate: ((metadata.common.date as string).includes("-")) ? metadata.common.date : formatDate(metadata.common.date as string)
                            },
                            artists: metadata.common.artists?.map((item: any) => ({
                                name: item
                            })) || [],
                            thumbnail: thumbnail
                        })
                    } catch (error) {
                        console.error(`Could not parse metadata for ${filePath}:`, error);
                        // If metadata parsing fails for a file, return basic info so the app doesn't break
                        files.push({
                            type: "local:track",
                            track: {
                                name: path.basename(dirent.name, path.extname(dirent.name)),
                                filename: dirent.name,
                                path: filePath,
                                duration: 0,
                                releaseDate: ""
                            },
                            artists: [],
                            thumbnail: null
                        })
                    }
                }


                writeFileSync(`${executableDir}\\BE\\localfile\\local.json`, JSON.stringify(files))

                return res.status(200).json({
                    type: "local:folder",
                    name: path.basename(folderPath),
                    path: folderPath,
                    tracks: files
                });
            } catch (error) {
                console.error("Error in /local endpoint:", error);
                return res.status(500).json({ message: "Internal server error while reading local files. Ensure the configured folder exists and is accessible." });
            }
        });

        app.post("/local", (req, res) => {
            const { name } = req.body;
            res.status(501).json({ message: "Not Implemented" });
        });


        // --- Static File Serving and Wildcard Route ---
        // Serves the React frontend. This should come AFTER all API routes.


        if (mode === Server_mode.server) {
            const buildPath = path.join(executableDir, 'build');
            app.use(express.static(buildPath));
            app.get('*', (req, res) => {
                res.sendFile(path.join(buildPath, 'index.html'));
            });

        }
        // const urlToOpen = `http://localhost:${port}`

        // --- Start Server ---
        app.listen(port, () => {
            console.log(`Server is running successfully on port ${port}`);
            console.log(`CORS is configured for origin: ${origin}`);
            // Call the function to open the URL
            // openUrlInBrowser(urlToOpen);
        });

    } catch (error) {
        console.error("Failed to start the server:", error);
        // process.exit(1);
    }

}


// --- Run the Application ---
// server();
