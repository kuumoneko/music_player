import Spotify from "./spotify/index.js";
import { Music_options } from "../../types/index.js";
import Youtube from "./youtube/index.js";

export default class Music {
    public youtube: Youtube;
    public spotify: Spotify;

    constructor(options: Music_options) {
        this.youtube = new Youtube({
            youtube_api_key: options.youtube_api_key,
            google_client_id: options.google_client_id,
            google_client_secret: options.google_client_secret,
            redirect_uris: options.redirect_uris,
            port: options.port || 3000
        })
        this.spotify = new Spotify({
            spotify_api_key: options.spotify_api_key,
            spotify_client: options.spotify_client,
            port: options.port || 3000
        })
    }

    convert_link(link: string) {
        if (link.includes("youtu")) {
            const youtube_link = link.split(link.includes("?si=") ? "?si=" : "&si=")[0];
            // short form
            let temp: string = "";
            if (youtube_link.includes("youtu.be")) {
                temp = youtube_link.split("youtu.be/")[1];
            }
            // long form
            else if (youtube_link.includes("youtube.com")) {
                if (youtube_link.includes("watch")) {
                    temp = youtube_link.split("watch?v=")[1]
                }
                else if (youtube_link.includes("list")) {
                    temp = youtube_link.split("?list=")[1]
                }
            }
            return {
                source: "youtube",
                mode: temp.length > 20 ? "playlist" : "track",
                id: temp
            }
        }
        // if link from spotify
        else if (link.includes("spot")) {
            let spotify_link = link.split(link.includes("?si=") ? "?si=" : "&si=")[0];
            const mode = spotify_link.includes("playlist") ? "playlist" : spotify_link.includes("track") ? "track" : "album"
            spotify_link = spotify_link.split(`${mode}/`)[1]
            return {
                source: "spotify",
                mode: mode,
                id: spotify_link
            }
        }
        else {
            return {
                source: "other",
                mode: "",
                id: "This is not a valid link"
            };
        }
    }


    async search(link: string | { source: string, mode: string, id: string }, where?: string): Promise<any> {

        let { source, mode, id } = (typeof link === 'string') ? this.convert_link(link) : link;
        if (source === "youtube") {
            if (mode === "playlist") {
                return await this.youtube.fetchPlaylistVideos(id);
            }
            else {
                return await this.youtube.fetchVideos(id);
            }
        }
        // if link from spotify
        else if (source === "spotify") {
            if (mode === "playlist") {
                return await this.spotify.fetchPlaylistVideos_spotify(id);
            }
            else if (mode === "album") {
                return await this.spotify.fetchAlbumVideos_spotify(id);
            }
            else if (mode === "track") {
                return await this.spotify.fetchTrackVideos_spotify(id);
            }
        }
        else {
            if (where === "youtube") {
                return await this.youtube.search_youtube_video(link as string);
            }
            else if (where === "spotify") {
                return await this.spotify.search_spotify_video(link as string);
            }
        }
    }
}