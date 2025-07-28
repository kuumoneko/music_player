import pkg from 'electron'
import path from "node:path"
import { writeFileSync, readFileSync, statSync, promises, Dirent } from "node:fs"
import * as mm from 'music-metadata';
import { createAuthWindow } from "./auth.ts"
import { Audio_format, Mode, Playlist } from './types/index.ts'
import Downloader from './downloader/index.ts'
import { getDataFromDatabase, writeDataToDatabase } from "./dist/databse.ts"
import express from "express";
import cors from 'cors';

const { app, BrowserWindow, ipcMain, Menu } = pkg

const mode: Mode = Mode.test;


const generateRandomString = (length: number) => {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const values = crypto.getRandomValues(new Uint8Array(length));
    return values.reduce((acc, x) => acc + possible[x % possible.length], "");
}

// let backendProcess;
let mainWindow: pkg.BrowserWindow;
const executablePath = process.execPath;
const __dirname = path.dirname(executablePath);
// console.log(__dirname)

const executableDir = path.join(__dirname, "../../../src/electron")
// console.log("this folder: " + executableDir)

const system = getDataFromDatabase(executableDir, "data", "system");

const port = Number(system["port"] as string) || 3000;

// - - - - - Node express server for getting auth code from Youtube or Spotify - - - - - -
const server = express();
const corsOptions = {
    origin: system.web?.redirect_uris ? system.web.redirect_uris : [`http://localhost:${port}`],
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true,
};
server.use(cors(corsOptions));
server.use(express.json());
server.listen(port, () => {
    console.log(`Server is running successfully on port ${port}`);
    console.log(`CORS is configured for origin: http://localhost:${port}`);
});
server.get("/", (req, res) => {
    res.status(204)
})

// - - - - - - Downloader class - - - - - - 
let downloader = new Downloader({
    ytdlp: path.join(executableDir, 'support', 'yt-dlp.exe'),
    spotdlp: path.join(executableDir, 'support', 'spot-dlp.exe'),
    ffmpeg: path.join(executableDir, 'support', 'ffmpeg', 'ffmpeg.exe'),
    download_folder: path.join(executableDir, 'download'),
    curr_folder: path.join(executableDir),
    spot_errors: path.join(executableDir, 'BE', 'spot.txt'),
    audio_format: Audio_format.mp3,
    youtube_api_key: system.Youtube_Api_key,
    google_client_id: system.web.client_id,
    google_client_secret: system.web.client_secret,
    redirect_uris: system.web.redirect_uris,
    spotify_api_key: system.Spotify_Api_key,
    spotify_client: system.Spotify_client,
    port: port

}, mode as Mode);

// - - - - - - Check if access_token is expired - - - - - - - 
setInterval(() => {
    async function run() {
        const data = getDataFromDatabase(executableDir, "data", "user");

        let res: any = {
            youtube: data.youtube,
            spotify: data.spotify,
            local: data.local
        }

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
                spotify_client: system.Spotify_client,
                port: port
            }, downloader.mode)
        }
    }
    run();
}, 1000);


// - - - -  - main electron app - - - -  - -
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1680,
        height: 1060,
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, "../../../src/electron/preload/preload.js"),
            nodeIntegration: true,
            contextIsolation: true,
        },
    });

    const load_from = (mode === Mode.deploy) ? path.join(__dirname, "../../../build/index.html") : "http://localhost:3000"
    mainWindow.loadURL(load_from);
    mainWindow.webContents.openDevTools();
    Menu.setApplicationMenu(null);
    mainWindow.on('closed', () => {
        try { mainWindow.close(); } catch { }
    });
}

ipcMain.on('app-close', () => {
    try { mainWindow.close(); } catch { }
});

app.on('ready', () => {
    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});

app.on("error", (error: any) => {
    console.log("Error ", error)
})

downloader.check_env().then(() => {
    console.log("hello world!")
})

enum Data {
    login = "login",
    logout = "logout",
    download = "download",
    download_status = "download_status",
    user = "user",
    localfile = "localfile",
    local = "local",
    search = "search",
    track = "track",
    playlist = "playlist",
    likedsongs = "likedsongs",
    userplaylist = "userplaylist",
    stream = "stream"
}

const give_error = (event: any, from: Data, message: string) => {
    event.reply('received_data', { message: message, ok: false, from: from });
}

const give_data = (event: any, from: Data, data: any = {}) => {
    event.reply('received_data', {
        ok: true,
        data: data,
        from: from
    });
}

// - - - - - - AUTH - - - - - 
ipcMain.on("login", async (event: any, data: { where: string }) => {
    const { where } = data;
    let authUrl: string;
    const redirectUri = `http://localhost:${port}`

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
        const token: string = await createAuthWindow(authUrl, port) as string;

        let data: any;
        const user = getDataFromDatabase(executableDir, "data", "user");

        if (where === "youtube") {
            const gg_token = await downloader.music.youtube.gettoken(token);
            console.log(gg_token)
            data = await downloader.music.youtube.fetch_youtube_user(gg_token.access_token);



            writeDataToDatabase(executableDir, "data", "user", {
                youtube: {
                    refresh_token: gg_token.refresh_token,
                    access_token: gg_token.access_token,
                    expires: new Date().getTime() + gg_token.expires_in * 1000,
                    user: data
                },
                spotify: user.spotify,
                local: user.local
            })
        }
        else {
            const spotify_user = await downloader.music.spotify.verifySpotifyToken(token) as any;
            data = spotify_user.user;

            writeDataToDatabase(executableDir, "data", "user", {
                spotify: {
                    id: spotify_user.user.id,
                    refresh_token: spotify_user.refresh_token,
                    access_token: spotify_user.access_token,
                    expires: spotify_user.expires,
                    user: data
                },
                youtube: user.youtube,
                local: user.local
            })
        }

        return give_data(event, Data.login, { user: data });
    }
    catch (e: any) {
        console.log(e)
        return give_error(event, Data.login, e)
    }
})

ipcMain.on("logout", (e, data: { where: string }) => {
    const { where } = data;

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
        return give_data(e, Data.logout)
    }
    catch (e) {
        return give_error(e, Data.logout, `Internal server error while logging out with ${where}`)
    }
})

// - - - - - - DOWNLOAD - - - - - 

ipcMain.on("download", async (e: any, data: { format: Audio_format, links: [{ source: string, mode: string, id: string }] }) => {
    try {
        const { format, links } = data;

        if (!links || links.length as number === 0) {
            // e.reply('received_data', { ok: false, message: "No links provided." });
            return give_error(e, Data.download, "No links provided.");
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
        return give_data(e, Data.download);
        // e.reply('received_data', { ok: true });

    } catch (error) {
        return give_error(e, Data.download, "Error in /download endpoint:" + error)
        // console.error("Error in /download endpoint:", error);
    }
})

ipcMain.on("download_status", (e: any) => {
    return give_data(e, Data.download_status, { status: downloader.get_status() });
})

// - - - - - USER - - - - -

ipcMain.on("user", (e) => {
    const data = getDataFromDatabase(executableDir, "data", "user");
    return give_data(e, Data.user, {
        youtube: data.youtube.access_token ? data.youtube.user : false,
        spotify: data.spotify.access_token ? data.spotify.user : false
    })
})


ipcMain.on("localfile", async (e, req: { location: string }) => {
    const { location } = req;
    if (!location || typeof location !== 'string') {
        ;
        return give_error(e, Data.localfile, "A valid file path 'location' is required.")
        // return res.status(400).json({ message:  });
    }

    try {

        // console.log(location);

        try {
            const stats = statSync(location);
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
                downloader.set_download_foler(location);
                return give_data(e, Data.localfile, { folder: location });
                // return res.status(200).json({ folder: location });

            } else {
                return give_error(e, Data.localfile, "It is not folder")
                // return res.status(400).json({ message:  });

            }
        }
        catch (e: any) {
            if (e.code === "ENOENT") {
                // console.log("Folder is not existed");
                return give_error(e, Data.localfile, "Folder not found");
                // return res.status(404).json({ message: "Folder not found" });

            }
        }

    } catch (error: any) {
        console.error(`Error processing path '${location}':`, error);;
        return give_error(e, Data.localfile, "Internal server error while processing the path.")
        // return res.status(500).json({ message:  });
    }


})

ipcMain.on("local", async (e) => {
    try {
        const { local } = getDataFromDatabase(executableDir, "data", "user");

        if (!local || !local.folder) {
            return give_error(e, Data.local, "Local music folder not set.")

            // return res.status(400).json({ message:  });
        }

        const locall = JSON.parse(readFileSync(`${executableDir}\\data\\localfile\\local.json`, { encoding: "utf-8" }) as string)

        const folderPath = local.folder;
        const dirents = await promises.readdir(folderPath, { withFileTypes: true });
        const audioExtensions = ['.mp3', '.wav', '.flac', '.m4a', '.ogg', '.aac'];

        const files: any[] = locall || [];

        const audiofiles = dirents.filter(dirent => dirent.isFile() && audioExtensions.includes(path.extname(dirent.name).toLowerCase()))

        const difer = audiofiles.filter((dirent: Dirent) =>
            !locall.find((item: any) => {
                return item.track.id === `${folderPath}\\${dirent.name}`
            })
        )

        // console.log(difer)

        if (difer.length === 0) {
            return give_data(e, Data.local, {
                type: "local:folder",
                name: path.basename(folderPath),
                path: folderPath,
                tracks: locall,
            })
            // return res.status(200).json()
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


        writeFileSync(`${executableDir}\\data\\localfile\\local.json`, JSON.stringify(files))

        return give_data(e, Data.local, {
            type: "local:folder",
            name: path.basename(folderPath),
            path: folderPath,
            tracks: files
        })
    } catch (error) {
        console.error("Error in /local endpoint:", error);
        return give_error(e, Data.local, "Internal server error while reading local files. Ensure the configured folder exists and is accessible.")
    }
})


// - - - - - DATA - - - - 

ipcMain.on("search", async (e, data: { where: string, query: string }) => {
    const { where, query } = data;
    try {
        const result = await downloader.music.search(query, where);
        return give_data(e, Data.search, result)
        // return res.status(200).json(result);
    }
    catch (e) {
        console.error(e);
        return give_error(e, Data.search, "Internal server error while searching");
    }
})
ipcMain.on("track", async (e, req: { where: string, id: string }) => {
    const { where, id } = req;

    try {
        const data = getDataFromDatabase(executableDir, "data", "track");

        if (where === "youtube") {
            if (data.youtube[id]) {
                const video = data.youtube[id];
                return give_data(e, Data.track, {
                    type: "youtube:track",
                    thumbnail: video.thumbnail || "",
                    artists: video.artists,
                    track: video.track
                })
                // return res.status(200).json();
            }
            const track = await downloader.music.youtube.fetchVideos(id);
            data.youtube[id] = {
                thumbnail: track.thumbnail,
                artists: track.artists,
                track: track.track,
                music_url: null
            };
            writeDataToDatabase(executableDir, "data", "track", data);
            return give_data(e, Data.track, track);
            // return res.status(200).json(track);
        } else {
            if (data.spotify[id]) {
                const video = data.spotify[id]
                return give_data(e, Data.track, {
                    type: "spotify:track",
                    thumbnail: video.thumbnail || "",
                    artists: video.artists,
                    track: video.track
                })
                // return res.status(200).json();
            }
            const track = await downloader.music.spotify.fetchTrackVideos_spotify(id);
            data.spotify[id] = {
                thumbnail: track.thumbnail,
                artists: track.artists,
                track: track.track,
                music_url: null
            };
            writeDataToDatabase(executableDir, "data", "track", data);
            return give_data(e, Data.track, track)
            // return res.status(200).json(track);
        }
    }
    catch (e) {
        console.error(e);
        return give_error(e, Data.track, "Internal server error while getting track")
        // return res.status(400).json({
        //     message: 
        // })
    }

})
ipcMain.on("playlist", async (e, req: { where: string, id: string }) => {
    const { where, id } = req;

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

            if (usr_ply.youtube.map((item: any) => item.playlistId).includes(id)) {
                if (!youtube.access_token) {
                    return give_error(e, Data.playlist, "Youtube Account is not connected, please login in Settings");
                }
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

            return give_data(e, Data.playlist, {
                type: "youtube:playlist",
                thumbnail: playlist.thumbnail,
                name: playlist.name,
                duration: ress.map((item: any) => item.track.duration).reduce((a: number, b: number) => a + b, 0),
                id: playlist.id,
                tracks: ress
            })

            // return res.status(200).json();
        } else {
            if (!spotify.access_token) {
                return give_error(e, Data.playlist, "Spotify Account is not connected, please login in Settings");

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


            return give_data(e, Data.playlist, playlist)
        }
    }
    catch (e) {
        console.error(e)
        return give_error(e, Data.playlist, "Internal server error while getting playlist items")
    }

})
ipcMain.on("likedsongs", async (e, data: { where: string }) => {
    const { where } = data;
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
                return give_error(e, Data.likedsongs, "Youtube Account is not connected, please login in Settings");
                // return res.status(404).json({
                //     message: "Youtube Account is not connected"
                // });
            }

            const liked_songs = await downloader.music.youtube.fetchLikedVideos(youtube.access_token);
            return give_data(e, Data.likedsongs, liked_songs)
            // res.status(200).json(liked_songs);
        } else {
            if (!spotify.access_token) {
                return give_error(e, Data.likedsongs, "Spotify Account is not connected, please login in Settings");

                // return res.status(404).json({
                //     message: "Spotify Account is not connected"
                // });
            }

            const liked_songs = await downloader.music.spotify.fetch_spotify_user_saved_playlists(spotify.access_token);
            return give_data(e, Data.likedsongs, liked_songs)
            // return res.status(200).json(liked_songs);
        }
    }
    catch (e) {
        console.log(e);
        return give_error(e, Data.likedsongs, "Internal server error while getting liked songs")
        // return res.status(500).json({
        //     message: "Internal server error while getting liked songs"
        // })
    }
})

ipcMain.on("user_playlists", async (e) => {
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
        writeDataToDatabase(executableDir, "data", "userplaylists", {
            youtube: youtube_playlists.length > 0 ? youtube_playlists : data.youtube,
            spotify: spotify_playlists.length > 0 ? spotify_playlists : data.spotify
        })
        return give_data(e, Data.userplaylist, {
            youtube: youtube_playlists.length > 0 ? youtube_playlists : ["Youtube Account is not connected"],
            spotify: spotify_playlists.length > 0 ? spotify_playlists : ["Spotify Account is not connected"]
        })
    }
    catch (e) {
        console.error(e);
        return give_error(e, Data.userplaylist, "Internal server error while getting user playlist")
    }
})

ipcMain.on("stream", async (e, req: { where: string, mode: string, id: string }) => {
    const { where, mode, id } = req;
    try {

        if (!id) {
            return give_error(e, Data.stream, "Music ID is required")
        }

        if (!mode) {
            return give_error(e, Data.stream, "Music Mode is required")
        }

        if (where === "local") {

            const audioBuffer = readFileSync(id);
            const base64Audio = audioBuffer.toString('base64');

            return give_data(e, Data.stream, {
                url: base64Audio
            })
        }

        let musicId = "";
        const data = getDataFromDatabase(executableDir, "data", "track");
        // const resss = data[where][id]
        // console.log(resss)
        if (data[where][id] && data[where][id]?.music_url !== null) {

            const ress = await fetch(data[where][id].music_url, {
                method: "HEAD",
            })

            // console.log(ress.status)

            if (ress.status !== 403) {
                // console.log(`Link "${data[where][id].music_url}" is OK (Status: ${res.status})`);
                return give_data(e, Data.stream, { url: data[where][id].music_url })
                // return res.status(200).json({
                //     url: data[where][id].music_url
                // })
            }
        }

        if (where === "youtube") {
            musicId = id;
        }
        else {
            const track = await downloader.music.spotify.fetchTrackVideos_spotify(id);


            const findYtbTrack = await downloader.music.youtube.findMatchingVideo(track)
            if (!findYtbTrack) {
                return give_error(e, Data.stream, "Music not found");
                // return res.status(404).json({
                //     message: "Music not found"
                // });
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
        return give_data(e, Data.stream, { url: bestAudio })
        // return res.status(200).json({ url: bestAudio });
    } catch (error) {
        console.error('Error fetching audio stream:', error);
        return give_error(e, Data.stream, 'Internal server error while getting stream url')
        // return res.status(500).send('Internal server error while getting stream url');
    }
})

