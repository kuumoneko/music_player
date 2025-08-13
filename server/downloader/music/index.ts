import Spotify from "./spotify/index.js";
import { Music_options, Track } from "../../types/index.js";
import Youtube from "./youtube/index.js";
import path from "node:path";

export default class Music {
    public youtube: Youtube;
    public spotify: Spotify;

    constructor(options: Music_options) {
        this.youtube = new Youtube({
            youtube_api_key: options.youtube_api_key,
            google_client_id: options.google_client_id,
            google_client_secret: options.google_client_secret,
            redirect_uris: options.redirect_uris,
            port: options.port || 3000,
            endpoints: options.endpoints,
            database: path.join(options.database, "data", "youtube")
        })
        this.spotify = new Spotify({
            spotify_api_key: options.spotify_api_key,
            spotify_client: options.spotify_client,
            port: options.port || 3000,
            database: path.join(options.database, "data", "spotify")
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
                return await this.youtube.fetch_playlist(id);
            }
            else {
                return await this.youtube.fetch_track([id]);
            }
        }
        // if link from spotify
        else if (source === "spotify") {
            if (mode === "playlist") {
                return await this.spotify.fetch_playlist(id);
            }
            else if (mode === "album") {
                return await this.spotify.fetch_album(id);
            }
            else if (mode === "track") {
                return await this.spotify.fetch_track(id);
            }
        }
        else {
            if (where === "youtube") {
                return await this.youtube.search(link as string);
            }
            else if (where === "spotify") {
                return await this.spotify.search(link as string);
            }
        }
    }

    async findMatchingVideo(trackToMatch: Track): Promise<Track | null> {
        console.log(trackToMatch)
        const trackId = trackToMatch.track?.id || "";
        const trackName = trackToMatch.track?.name || "";
        const artistName = (trackToMatch.artists as any)[0].name || "";
        const trackDuration: number = trackToMatch.track?.duration as number; // in ms
        let database: any;
        if (trackToMatch.type.includes("spot")) {
            database = this.spotify.getdata("track");
            const track = database[trackId];
            console.log(track)
            if (track && track.matched !== null) {
                const data = await this.youtube.fetch_track([track.matched]);
                console.log("lmao", data[0])
                return data[0];
            }
        }

        if (!trackName || !artistName) {
            throw new Error("Track name or artist is missing.");
        }

        // A good search query using the track name and artist.
        const searchQuery = `${trackName} ${artistName}`;

        try {
            let searchResults = (await this.youtube.search(searchQuery)).tracks as Track[];

            const ids: string[] = searchResults.map((track: Track) => {
                return track.track?.id || ""
            })

            const contentRating = await this.youtube.fetch_contentRating(ids);

            const result_track = searchResults.map((item: Track) => {
                return {
                    type: "youtube:track",
                    thumbnail: item.thumbnail,
                    artists: item.artists,
                    track: {
                        name: item.track?.name,
                        id: item.track?.id,
                        duration: item.track?.duration, // in miliseconds
                        releaseDate: item.track?.releaseDate,
                        contentRating: contentRating[item.track?.id as any]
                    },
                }
            })

            if (!searchResults || searchResults.length === 0) {
                return null;
            }

            let bestMatch: Track | null = null;
            let bestScore = -1;

            const DURATION_TOLERANCE_MS = 60 * 1000;

            for (const ytVideo of result_track) {
                const durationDifference = Math.abs(ytVideo.track.duration as number - trackDuration);

                // Heuristic: ignore videos with a huge duration difference
                if (durationDifference > DURATION_TOLERANCE_MS) {
                    continue;
                }

                let score = 0;
                const videoTitle: string = ytVideo.track?.name?.toLowerCase() as string;
                const channelTitle = (ytVideo.artists as any)[0]?.name.toLowerCase();
                const lowerCaseArtistName = artistName.toLowerCase();

                // Score based on title keywords and channel name
                if (videoTitle.includes(trackName.toLowerCase())) score += 2;
                if (channelTitle.includes(lowerCaseArtistName)) score += 3; // Strong indicator
                else if (videoTitle.includes(lowerCaseArtistName)) score += 1;

                if (videoTitle.includes("official audio") || videoTitle.includes("art track")) score += 5;
                else if (videoTitle.includes("official video") || videoTitle.includes("official music video")) score += 3;
                else if (videoTitle.includes("lyrics")) score += 2;

                if (ytVideo.track.contentRating?.ytRating === "ytAgeRestricted") {
                    score -= 100
                }

                // Add score based on duration proximity
                if (durationDifference < DURATION_TOLERANCE_MS) {
                    score += (5 * (1 - (durationDifference / DURATION_TOLERANCE_MS)));
                }

                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = ytVideo as any;
                }
            }

            if (trackToMatch.type.includes("spot")) {
                database[trackId] =
                {
                    "thumbnail": trackToMatch.thumbnail,
                    "artists": trackToMatch.artists,
                    "track": trackToMatch.track,
                    "music_url": database[trackId] || null,
                    "matched": bestMatch?.track?.id
                }
                this.spotify.writedata("track", database);
            }


            return bestMatch;
        }
        catch (e) {
            throw new Error(e);
        }
    }
}