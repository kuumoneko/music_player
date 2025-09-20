import path from "node:path";
import { readFileSync, statSync, promises } from "node:fs";

import express, { Response } from "express";

import { Audio_format, Download_item, Mode, Playlist, Track, Artist, User_Artist, youtube_api_keys, Status } from "./types/index.js";
import Downloader from "./downloader/index.js";
import { getDataFromDatabase, writeDataToDatabase } from "./dist/databse.js";

const mode: Mode = Mode.react;

const generateRandomString = (length: number) => {
    const possible =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const values = crypto.getRandomValues(new Uint8Array(length));
    return values.reduce((acc, x) => acc + possible[x % possible.length], "");
};
const executablePath = process.execPath;

let __dirname: string = ""
switch (mode as Mode) {
    case Mode.app:
        __dirname = "D:\\coding\\music player";
        break;
    case Mode.deploy:
        __dirname = path.dirname(executablePath);
        break;
    default:
        __dirname = "D:\\coding\\music player\\server";
}

let executableDir = (mode as Mode === Mode.app) ? path.join(__dirname, "server") : __dirname;

console.log(__dirname);
console.log("this folder: " + executableDir);

const system = getDataFromDatabase(executableDir, "data", "system");
// port for the front end
const port = (mode as Mode === Mode.deploy) ? 3000 : 3001;

// default by 3000
const server_port = 3000
const server = express();

server.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', `*`);
    res.header('Access-Control-Allow-Methods', 'POST');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    res.header('Access-Control-Allow-Credentials', 'true');
    next();
});
server.use(express.json());
server.listen(server_port, () => {
    console.log(`Server is running successfully on port ${server_port}`);
    console.log(`CORS is configured for origin: *`);
});

if (mode as Mode === Mode.deploy || mode as Mode === Mode.app) {
    const folderPath = (mode as Mode === Mode.deploy) ? path.join(__dirname, "build") : path.join(__dirname, "app", 'build')
    server.use(express.static(folderPath));
    server.get('/', (req, res) => {
        res.sendFile(path.join(folderPath, 'index.html'));
    });
}

// - - - - - Check if api_key is reached quota - - - - - -
let downloader: Downloader = null as any
let temp: youtube_api_keys[] = [];
(async () => {
    const keys: youtube_api_keys[] = system.Youtube_Api_key;
    const video_test_id: string = system.test_id;
    for (const key of keys) {
        if (key.reach_quota) {
            temp.push({
                api_key: key.api_key,
                reach_quota: true,
                isAuth: key.isAuth,
                date_reached: new Date().toISOString().split('T')[0],
                time_reached: new Date().toISOString().split("T")[1].split(".")[0]
            })
            continue;
        }
        const url = `https://www.googleapis.com/youtube/v3/videos?id=${video_test_id}&key=${key.api_key}&fields=items.id`;
        const res = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
            }
        })
        const data = await res.json();
        const tempp = data.error?.errors?.filter((item: any) => {
            return item.reason === "quotaExceeded"
        }) || []
        if (data.error !== null && data.error !== undefined && data.error.code === 403 && tempp.length > 0) {
            temp.push({
                api_key: key.api_key,
                reach_quota: true,
                isAuth: key.isAuth,
                date_reached: new Date().toISOString().split('T')[0],
                time_reached: new Date().toISOString().split("T")[1].split(".")[0]
            })
        }
        else {
            temp.push({
                api_key: key.api_key,
                reach_quota: false,
                isAuth: key.isAuth,
                date_reached: "",
                time_reached: ""
            })
        }
    }
})().then(() => {
    // - - - - - - Downloader class - - - - - -.

    const endpoints = getDataFromDatabase(executableDir, "data", "youtube", "endpoint");
    downloader = new Downloader(
        {
            download_folder: path.join(executableDir, "download"),
            curr_folder: path.join(executableDir),
            audio_format: Audio_format.mp3,
            youtube_api_key: temp.length > 0 ? temp : system.Youtube_api_key,
            google_client_id: system.web.client_id,
            google_client_secret: system.web.client_secret,
            redirect_uris: system.web.redirect_uris,
            spotify_api_key: system.Spotify_Api_key,
            spotify_client: system.Spotify_client,
            port: port,
            endpoints: endpoints
        }
    )
});

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const wait_for_downloader = () => {
    return new Promise(async (resolve, reject) => {
        while (downloader === null || downloader === undefined) {
            await sleep(1000)
        }
        resolve(true)
    })
}

// - - - - - - Check if access_token is expired - - - - - - -
setInterval(() => {
    async function run() {
        if (downloader === null || downloader === undefined) {
            return;
        }

        const data = getDataFromDatabase(executableDir, "data", "user");

        let res: any = {
            youtube: data.youtube,
            spotify: data.spotify,
            local: data.local,
        };

        let lmao = false;

        if (
            data.youtube.expires &&
            data.youtube.expires <= new Date().getTime()
        ) {
            lmao = true;
            try {
                const Youtube: any = await downloader.music.youtube.refreshYoutubeToken(data.youtube.refresh_token);
                const user = await downloader.music.youtube.get_me(Youtube.access_token);
                res.youtube = {
                    access_token: Youtube.access_token,
                    expires: Youtube.expires,
                    refresh_token_expires: Youtube.refresh_token_expires_in,
                    refresh_token: res.youtube.refresh_token,
                    user: user,
                };
            }
            catch (e) {
                console.error(e);
                res.youtube = {
                    refresh_token: null,
                    access_token: null,
                    expires: null,
                    user: null
                };
            }
        }

        if (
            data.spotify.expires &&
            data.spotify.expires <= new Date().getTime()
        ) {
            lmao = true;
            try {
                const spotifyUser: any = await downloader.music.spotify.refreshSpotifyToken(data.spotify.refresh_token);
                const user = await downloader.music.spotify.get_me(
                    spotifyUser.access_token
                );
                res.spotify = {
                    access_token: spotifyUser.access_token,
                    expires: spotifyUser.expires,
                    refresh_token: spotifyUser.refresh_token
                        ? spotifyUser.refresh_token
                        : data.spotify.refresh_token,
                    user: user,
                };
            }
            catch (e) {
                res.spotify = {
                    access_token: null,
                    expires: null,
                    refresh_token: null,
                    user: null,
                };
            }
        }

        if (lmao) {
            writeDataToDatabase(executableDir, "data", "user", res);
            downloader = new Downloader(
                {
                    download_folder: downloader.folder,
                    curr_folder: downloader.curr_folder,
                    audio_format: downloader.audio_format as Audio_format,
                    youtube_api_key: system.Youtube_Api_key,
                    google_client_id: system.web.client_id,
                    google_client_secret: system.web.client_secret,
                    redirect_uris: system.web.redirect_uris,
                    spotify_api_key: system.Spotify_Api_key,
                    spotify_client: system.Spotify_client,
                    port: port,
                }
            );
        }

        const api_keys = downloader.music.youtube.youtube_api_key as youtube_api_keys[];
        let temp = system;
        temp.Youtube_Api_key = api_keys;
        if (api_keys.length > 0) {
            writeDataToDatabase(executableDir, "data", "system", temp);
        }
    }
    run();
}, 1000);

// - - - - - check if reach time to refresh quota - - - - -
setInterval(() => {
    if (downloader === null || downloader === undefined) { return }
    const now = new Date();
    const [now_year, now_month, now_date] = now.toISOString().split("T")[0].split("-").map((item: string) => { return Number(item) });
    const [now_hour, now_minute, now_second] = now.toISOString().split("T")[1].split(".")[0].split(":").map((item: string) => { return Number(item) });
    const keys = downloader.music.youtube.youtube_api_key;

    for (let key of keys) {
        if (!key.reach_quota) {
            continue;
        }

        const [year, month, date] = key.date_reached.split("-").map((item: string) => { return Number(item) })
        const [hour, minute, second] = key.time_reached.split(":").map((item: string) => { return Number(item) });

        if (
            new Date(year, month, date, hour, minute, second) > new Date(year, month, date, 7, 0, 0) &&
            new Date(now_year, now_month, now_date, now_hour, now_minute, now_second).getTime() > (new Date(year, month, date, 7, 0, 0).getTime() + 24 * 60 * 60 * 1000)
        ) {
            key.date_reached = "";
            key.time_reached = "";
            key.reach_quota = false;
        }
        else if (
            new Date(year, month, date, hour, minute, second) < new Date(year, month, date, 7, 0, 0) &&
            new Date(now_year, now_month, now_date, now_hour, now_minute, now_second) > new Date(year, month, date, 7, 0, 0)
        ) {
            key.date_reached = "";
            key.time_reached = "";
            key.reach_quota = false;
        }
    }
    downloader.music.youtube.youtube_api_key = keys;
}, 15 * 60 * 1000); // 15 minutes

// - - - - - - DATA - - - - - - -

const give_error = (event: Response, message: string) => {
    event.status(500).json(
        { message: message }
    )
};

const give_data = (event: Response, data: any = {}) => {
    try {
        event.status(200).json({ data: data })
    }
    catch (e) {
        console.log(`Error with error ${e}`);
    }
};

// - - - - - - AUTH - - - - -
server.post("/login", async (req, res) => {
    try {
        const { where } = req.body;
        const redirectUri = `http://localhost:${port}`;
        let authUrl: string;

        if (where === "youtube") {
            authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${system.web.client_id
                }&redirect_uri=${encodeURIComponent(
                    redirectUri
                )}&response_type=code&scope=https://www.googleapis.com/auth/youtube.readonly&state=${generateRandomString(
                    4
                )}&prompt=consent&access_type=offline`;
        } else {
            authUrl = `https://accounts.spotify.com/authorize?client_id=${system.Spotify_client
                }&response_type=code&redirect_uri=${encodeURIComponent(
                    redirectUri
                )}&scope=${encodeURIComponent(
                    [
                        "user-read-private",
                        "user-read-email",
                        "user-follow-read",
                        "playlist-modify-public",
                        "user-library-read",
                    ].join(" ")
                )}&state=${generateRandomString(16)}`;
        }
        return give_data(res, { url: authUrl });
    }
    catch (e) {
        console.error(e);
        return give_error(res, e);
    }
});

server.post("/auth", async (req, res) => {
    const { where, code } = req.body;
    try {
        const user = getDataFromDatabase(executableDir, "data", "user");
        if (where === "youtube") {
            const google_token = await downloader.music.youtube.get_token(code) as any;
            const googleUser = await downloader.music.youtube.get_me(google_token.access_token);

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

            return give_data(res, {
                user: googleUser
            })
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
            return give_data(res, {
                user: spotifyUser.user
            })
        }
    }
    catch (e) {
        console.error(e)
        give_error(res, "Invalid ID token")
    }
})

server.post("/logout", async (req, res) => {
    const { where } = req.body;
    const user = getDataFromDatabase(executableDir, "data", "user");

    try {
        if (where === "youtube") {
            writeDataToDatabase(executableDir, "data", "user", {
                youtube: {
                    refresh_token: null,
                    access_token: null,
                    expires: null,
                },
                spotify: user.spotify,
                local: user.local,
            });
        } else {
            writeDataToDatabase(executableDir, "data", "user", {
                spotify: {
                    id: null,
                    refresh_token: null,
                    access_token: null,
                    expires: null,
                },
                youtube: user.youtube,
                local: user.local,
            });
        }
        return give_data(res);
    } catch (e) {
        console.error(e)
        return give_error(e,
            `Internal server error while logging out with ${where}`
        );
    }
});

// - - - - - - DOWNLOAD - - - - -
server.post("/download", async (req, res) => {
    const { format, links } = req.body;
    await wait_for_downloader();
    try {
        console.log("- - - - - - - - - - PREPARING DATA TO DOWNLOAD - - - - - - - - - -")
        downloader.set_status(Status.prepare, '');

        if (!links || (links.length as number) === 0) {
            return give_error(res, "No links provided.");
        }

        downloader.set_audio_format(format as Audio_format);
        downloader.clear_links();
        const tracks_to_download: Download_item[] = [];

        for (const link of links) {
            const { source, mode } = link;
            const dataa: Track | Playlist = await downloader.music.search(link)

            if (mode === "playlist") {
                if (source === "youtube") {
                    const temp: Playlist = (dataa as Playlist)
                    const download_items: Download_item[] = [];
                    for (const item of temp.tracks as Track[]) {
                        // console.log(source, ' ', item.track?.name)

                        download_items.push({
                            title: downloader.format_title(item.track?.name as string) || "",
                            id: [item.track?.id || ""],
                            metadata: {
                                artist: (item.artists as any)[0].name || "",
                                year: item.track?.releaseDate || "",
                                thumbnail: item.thumbnail || "",
                                source: "youtube"
                            }
                        })
                    }

                    tracks_to_download.push(...download_items);

                }
                else if (source === "spotify") {
                    const temp: Playlist = (dataa as Playlist)

                    for (const item of (temp.tracks as Track[])) {
                        // console.log(source, ' ', item.track?.name)

                        const spotify_video: Track = await downloader.music.spotify.fetch_track(item.track?.id || "");
                        const matching_video: Track | null = await downloader.music.findMatchingVideo(spotify_video);

                        if (matching_video !== null) {
                            // console.log(matching_video)
                            tracks_to_download.push({
                                title: downloader.format_title(spotify_video.track?.name as string) || "",
                                id: [spotify_video.track?.id || "", matching_video.track?.id || ""],
                                metadata: {
                                    artist: (spotify_video.artists as any)[0].name,
                                    year: spotify_video.track?.releaseDate || "",
                                    thumbnail: spotify_video.thumbnail || "",
                                    source: "spotify"
                                }
                            })
                        }
                    }
                }
            }
            else if (mode === "track") {
                if (source === "youtube") {
                    const temp: Track = (dataa as Track)
                    tracks_to_download.push({
                        title: downloader.format_title(temp.track?.name as string) || "",
                        id: [temp.track?.id || ""],
                        metadata: {
                            artist: (temp.artists as any)[0].name || "",
                            year: temp.track?.releaseDate || "",
                            thumbnail: temp.thumbnail || "",
                            source: "youtube"
                        }
                    })
                }
                else if (source === "spotify") {
                    const temp: Track | null = await downloader.music.findMatchingVideo(dataa as Track);
                    const spotify_video: Track = await downloader.music.spotify.fetch_track((dataa as Track).track?.id || "");

                    if (temp !== null) {
                        tracks_to_download.push({
                            title: downloader.format_title(spotify_video.track?.name as string) || "",
                            id: [spotify_video.track?.id || "", temp.track?.id || ""],
                            metadata: {
                                artist: (spotify_video.artists as any)[0].name || "",
                                year: spotify_video.track?.releaseDate || "",
                                thumbnail: spotify_video.thumbnail || "",
                                source: "spotify"
                            }
                        })
                    }
                    else {
                        console.error("Cant find matched video")
                    }
                }
            }
        }
        console.log("- - - - - - - - - - READY TO DOWNLOAD - - - - - - - - - -")
        downloader.download_queue = tracks_to_download;

        const { local } = getDataFromDatabase(executableDir, "data", "user");
        if (
            local.folder !== "" &&
            local.folder !== undefined &&
            local.folder !== null
        ) {
            downloader.set_download_foler(local.folder);
        }
        downloader.set_status("Checking and removing unused files", '');
        await downloader.checking();

        downloader.download();
        return give_data(res);
    } catch (e) {
        console.error("Error in /download endpoint:" + e)
        return give_error(
            e,
            "Error in /download endpoint:" + e
        );
    }
});

server.post("/download_status", async (req, res) => {
    await wait_for_downloader();

    const temp = downloader.get_status()
    return give_data(res, {
        status: temp.status,
    });
})

// - - - - - USER - - - - -

server.post("/user", (req, res) => {
    const data = getDataFromDatabase(executableDir, "data", "user");
    return give_data(res, {
        youtube: data.youtube.access_token ? data.youtube.user : false,
        spotify: data.spotify.access_token ? data.spotify.user : false,
    });
})

server.post("/localfile", async (req, res) => {
    await wait_for_downloader();
    const { location } = req.body;
    if (!location || typeof location !== "string") {
        return give_error(
            res,
            "A valid file path 'location' is required."
        );
    }

    try {
        try {
            const stats = statSync(location);
            if (stats.isDirectory()) {
                const data = getDataFromDatabase(executableDir, "data", "profile");

                writeDataToDatabase(executableDir, "data", "profile", {
                    ...data,
                    local: location
                });
                downloader.set_download_foler(location);
                return give_data(res, { folder: location });
            } else {
                return give_error(res, "It is not folder");
            }
        } catch (e: any) {
            if (e.code === "ENOENT") {
                return give_error(res, "Folder not found");
            }
        }
    } catch (error: any) {
        console.error(`Error processing path '${location}':`, error);
        return give_error(
            res,
            "Internal server error while processing the path."
        );
    }
})

server.post("/local", async (req, res) => {
    await wait_for_downloader();

    try {
        const { local } = getDataFromDatabase(executableDir, "data", "profile");
        const local_files = getDataFromDatabase(executableDir, "data", "local", "local");

        if (!local) {
            return give_error(res, "Local music folder not set.");
        }

        const folderPath = local;
        const dirents = await promises.readdir(folderPath, {
            withFileTypes: true,
        });
        const audioExtensions = [".mp3", ".wav", ".flac", ".m4a", ".ogg", ".aac"];

        const files: any[] = [];

        const audiofiles = dirents.filter(
            (dirent) =>
                dirent.isFile() &&
                audioExtensions.includes(path.extname(dirent.name).toLowerCase())
        );

        for (const dirent of audiofiles) {
            const filePath = path.join(folderPath, dirent.name);
            try {
                const get_data = local_files.find((item: any) => {
                    return item.track.path === filePath
                })
                if (get_data !== null && get_data !== undefined) {
                    files.push(get_data)
                }
                else {
                    const metadata = await downloader.music.local.parseFile(filePath);
                    const thumbnail = metadata.thumbnail;

                    files.push({
                        type: "local:track",
                        track: {
                            name:
                                metadata.title ||
                                path.basename(dirent.name, path.extname(dirent.name)),
                            filename: dirent.name,
                            id: `${folderPath}\\${dirent.name}`,
                            path: filePath,
                            duration: (metadata.duration || 0) * 1000,
                            releaseDate: "",
                        },
                        artists: [{ name: metadata.artist }],
                        thumbnail: thumbnail
                    });
                }
            } catch (error) {
                console.error(`Could not parse metadata for ${filePath}:`, error);
                files.push({
                    type: "local:track",
                    track: {
                        name: path.basename(dirent.name, path.extname(dirent.name)),
                        filename: dirent.name,
                        path: filePath,
                        duration: 0,
                        releaseDate: "",
                    },
                    artists: [],
                    thumbnail: null,
                });
            }
        }

        writeDataToDatabase(executableDir, "data", "local", "local", files)

        return give_data(res, {
            type: "local:folder",
            name: path.basename(folderPath),
            path: folderPath,
            duration: files.reduce((a: number, b: Track) => a + (b.track?.duration as number || 0), 0),
            tracks: files,
        });
    } catch (error) {
        console.error("Error in /local endpoint:", error);
        return give_error(
            res,
            "Internal server error while reading local files. Ensure the configured folder exists and is accessible."
        );
    }
})

// - - - - - DATA - - - -

server.post("/search", async (req, res) => {
    await wait_for_downloader();

    const { where, query } = req.body;
    try {
        const result = await downloader.music.search(query, where);
        return give_data(res, result);
    } catch (e) {
        console.error("Error in /search endpoint:", e);
        return give_error(
            res,
            "Error in /search endpoint:" + e);
    }
});

server.post("/track", async (req, res) => {
    await wait_for_downloader();
    const { where, id } = req.body;
    try {
        if (where === "youtube") {
            const track = await downloader.music.youtube.fetch_track([id]);
            return give_data(res, track);
        }
        else {
            const track = await downloader.music.spotify.fetch_track(id);
            return give_data(res, track);
        }
    } catch (e) {
        console.error("Error in /track endpoint:", e);
        return give_error(res,
            "Error in /track endpoint:" + e
        );
    }
});

server.post("/playlist", async (req, res) => {
    await wait_for_downloader();

    const { where, id } = req.body;

    const {
        youtube,
        spotify,
    }: {
        youtube: {
            refresh_token: string;
            access_token: string;
            expires: number;
        };
        spotify: {
            id: string;
            refresh_token: string;
            access_token: string;
            expires: number;
        };
    } = getDataFromDatabase(executableDir, "data", "user");

    try {
        if (where === "youtube") {
            let playlist: Playlist = {
                type: "",
                id: "",
                name: "",
                thumbnail: "",
                duration: 0,
                tracks: [],
            };
            playlist = await downloader.music.youtube.fetch_playlist(
                id,
                youtube.access_token
            );

            return give_data(res, playlist);
        } else {
            if (!spotify.access_token) {
                return give_error(res,
                    "Spotify Account is not connected, please login in Settings"
                );
            }
            const playlist =
                await downloader.music.spotify.fetch_playlist(
                    id,
                    spotify.access_token
                );
            return give_data(res, playlist);
        }
    } catch (e) {
        console.error("Error in /playlist endpoint:", e);
        return give_error(res,
            "Error in /playlist endpoint:" + e
        );
    }
});

server.post("/likedsongs", async (req, res) => {
    await wait_for_downloader();

    const { where } = req.body;
    const {
        youtube,
        spotify,
    }: {
        youtube: {
            refresh_token: string;
            access_token: string;
            expires: number;
        };
        spotify: {
            id: string;
            refresh_token: string;
            access_token: string;
            expires: number;
        };
    } = getDataFromDatabase(executableDir, "data", "user");

    try {
        if (where === "youtube") {
            if (!youtube.access_token) {
                return give_error(res,
                    "Youtube Account is not connected, please login in Settings"
                );
            }

            const liked_songs = await downloader.music.youtube.fetch_liked_tracks(
                youtube.access_token
            );
            return give_data(res, liked_songs);
        } else {
            if (!spotify.access_token) {
                return give_error(res,
                    "Spotify Account is not connected, please login in Settings"
                );
            }

            const liked_songs =
                await downloader.music.spotify.fetch_liked_tracks(
                    spotify.access_token
                );
            return give_data(res, liked_songs);
        }
    } catch (e) {
        console.error("Error in /likedsongs endpoint:", e);
        return give_error(res,
            "Error in /likedsongs endpoint:" + e);
    }
});

server.post("/userplaylist", async (req, res) => {
    await wait_for_downloader();

    const {
        youtube,
        spotify,
    }: {
        youtube: {
            refresh_token: string;
            access_token: string;
            expires: number;
        };
        spotify: {
            id: string;
            refresh_token: string;
            access_token: string;
            expires: number;
        };
    } = getDataFromDatabase(executableDir, "data", "user");
    try {
        let spotify_playlists: any[] = [],
            youtube_playlists: any[] = [];

        if (spotify.access_token !== null && spotify.access_token !== undefined) {
            spotify_playlists = (
                (await downloader.music.spotify.fetch_user_playlists(
                    spotify.access_token
                )) as any
            ).playlists;
        }

        if (youtube.access_token !== null && youtube.access_token !== undefined) {
            youtube_playlists = (
                (await downloader.music.youtube.fetch_user_playlists(
                    youtube.access_token
                )) as any
            ).playlists;
        }
        return give_data(res, {
            youtube:
                youtube_playlists.length > 0
                    ? youtube_playlists
                    : ["Youtube Account is not connected"],
            spotify:
                spotify_playlists.length > 0
                    ? spotify_playlists
                    : ["Spotify Account is not connected"],
        });
    } catch (e) {
        console.error("Error in /userplaylist endpoint:", e);
        return give_error(res,
            "Error in /userplaylist endpoint:" + e);
    }
});

server.post("/stream", async (req, res) => {
    await wait_for_downloader();

    const { where, id } = req.body;
    try {
        if (!id) {
            return give_error(res, "Music ID is required");
        }

        if (where === "local") {
            const audioBuffer = readFileSync(id);
            const base64String = audioBuffer.toString('base64');
            return give_data(res, {
                url: base64String,
            });
        }

        const dataa_args: string[] = [executableDir, "data", where as string];
        if (where === "youtube") {
            dataa_args.push("tracks")
        }
        dataa_args.push(id)
        let data = getDataFromDatabase(...dataa_args);
        let music_url: string = (typeof data?.music_url === 'string') ? data?.music_url : ""
        if (music_url === null || music_url === undefined) {
            music_url = ""
        }
        // check if the playback url is expired?
        if (music_url.includes("http")) {
            const test_link_response = await fetch(music_url as string);
            if (!test_link_response.ok) {
                music_url = ""
            }
        }

        // send to server if the data is available
        if (music_url !== "") {
            return give_data(res, {
                url: music_url,
            });
        }

        let musicId = "";
        if (where === "youtube") {
            musicId = id;
        } else {
            const track = await downloader.music.spotify.fetch_track(id);

            const findYtbTrack = await downloader.music.findMatchingVideo(track);
            if (!findYtbTrack) {
                return give_error(res, "Music not found");
            }

            musicId = findYtbTrack.track?.id || "";
        }

        const bestAudio = await downloader.getAudioURLAlternative(musicId);

        data = {
            ...data,
            music_url: bestAudio,
        };

        writeDataToDatabase(...dataa_args, data);

        return give_data(res, { url: bestAudio });
    } catch (e) {
        console.error("Error in /stream endpoint:", e);
        return give_error(res,
            "Error in /stream endpoint:" + e
        );
    }
}
);

server.post("/likedartists", async (req, res) => {
    await wait_for_downloader();

    const {
        youtube,
        spotify,
    }: {
        youtube: {
            refresh_token: string;
            access_token: string;
            expires: number;
        };
        spotify: {
            id: string;
            refresh_token: string;
            access_token: string;
            expires: number;
        };
    } = getDataFromDatabase(executableDir, "data", "user");

    try {
        let spotify_artists: User_Artist = {},
            youtube_artists: User_Artist = {};

        if (spotify.access_token !== null && spotify.access_token !== undefined) {
            spotify_artists = await downloader.music.spotify.fetch_following_artists(spotify.access_token);
        }

        if (youtube.access_token !== null && youtube.access_token !== undefined) {
            youtube_artists = await downloader.music.youtube.fetch_following_artists(youtube.access_token) as User_Artist
        }
        return give_data(res, {
            youtube:
                (youtube_artists.artists as Artist[])?.length > 0
                    ? youtube_artists.artists
                    : ["Youtube Account is not connected"],
            spotify:
                (spotify_artists.artists as Artist[])?.length > 0
                    ? spotify_artists.artists
                    : ["Spotify Account is not connected"],
        });
    } catch (e) {
        console.error("Error in /likedartists endpoint:", e);
        return give_error(res,
            "Error in /likedartists endpoint:" + e
        );
    }
})

server.post("/artist", async (req, res) => {
    await wait_for_downloader();

    try {
        const { where, id, pageToken } = req.body;

        let data: any = null;
        if (where === "youtube") {
            data = await downloader.music.youtube.fetch_artist(id, pageToken);
        }
        else {
            data = await downloader.music.spotify.fetch_artist(id);
        }
        give_data(res, data)
    }
    catch (e) {
        console.error("Error in /artist endpoint:", e)
        give_error(res, "Error in /artist endpoint:" + e);
    }
})

server.post("/new_tracks", async (req, res) => {
    await wait_for_downloader();

    try {
        const { items }: { items: any[] } = req.body;
        const youtube = items.filter((item: any) => { return item.source === "youtube" }),
            spotify = items.filter((item: any) => { return item.source === "spotify" });

        let data: any[] = [];
        if (youtube.length > 0) {
            const data_from_youtube: any = await downloader.music.youtube.test_new_tracks(
                youtube.map((item: any) => { return item.id })
            );
            data.push(...data_from_youtube);
        }
        if (spotify.length > 0) {
            const data_from_spotify = await downloader.music.spotify.get_new_tracks(
                spotify.map((item: any) => { return item.id })
            );
            data.push(...data_from_spotify);
        }
        give_data(res, data);
    }
    catch (e) {
        console.error("Error in /new_tracks endpoint:", e);
        give_error(res, "Error in /new_tracks endpoint:" + e);
    }
})

server.post("/profile", (req, res) => {
    try {
        const { mode, key, data } = req.body;
        if (mode === "get") {
            const dataa = getDataFromDatabase(executableDir, "data", "profile");
            const result = dataa[key];
            return give_data(res, result);
        }
        else {
            const dataa = getDataFromDatabase(executableDir, "data", "profile");

            writeDataToDatabase(executableDir, "data", "profile", {
                ...dataa,
                [key]: JSON.parse(data),
            });
            return give_data(res, "ok");
        }
    }
    catch (e) {
        console.error(e)
        return give_error(res, e)
    }
})