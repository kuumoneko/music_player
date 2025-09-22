import Downloader from "../downloader/index.js";
import { getDataFromDatabase, writeDataToDatabase } from "./databse.js";

export default async function check_user(downloader: Downloader, executableDir: string) {
    if (downloader === null || downloader === undefined) {
        return;
    }

    const data = getDataFromDatabase(executableDir, "data", "user");

    let res: any = {
        youtube: data.youtube,
        spotify: data.spotify,
        local: data.local,
    };

    let isEnd = false;

    if (
        data.youtube.expires &&
        data.youtube.expires <= new Date().getTime()
    ) {
        isEnd = true;
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
        isEnd = true;
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
    if (isEnd) {
        writeDataToDatabase(executableDir, "data", "user", res);
    }
    return isEnd
}