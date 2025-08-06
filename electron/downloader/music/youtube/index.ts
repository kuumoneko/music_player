import { Artist, Music_options, Playlist, Search, Track, User_Artist, UserPlaylist, youtube_api_keys } from "../../../types/index.js";

export default class Youtube {
    private maxResults = 200;
    public youtube_api_key: youtube_api_keys[];
    private google_client: string | undefined;
    private google_client_secret: string | undefined;
    private port: number = 3000;

    constructor(options: Music_options) {
        // client API
        this.youtube_api_key = options.youtube_api_key || [];
        this.google_client = options.google_client_id;
        this.google_client_secret = options.google_client_secret;
        this.port = options.port || 3000;
    }

    chose_api_key(isAuth: boolean) {
        if (isAuth) {
            return this.youtube_api_key.filter((item: youtube_api_keys) => {
                return item.isAuth === true && item.reach_quota === false
            })[0].api_key
        }
        else {
            return this.youtube_api_key.filter((item: youtube_api_keys) => {
                return item.isAuth === false && item.reach_quota === false
            })[0].api_key
        }
    }

    async fetch_data(
        url: string,
        isAuth: boolean,
        access_token?: string | null) {
        let done = false;
        let data: any;
        while (!done) {
            const key = this.chose_api_key(isAuth);
            if (key.length === 0) {
                throw new Error("Reach quota of all apikey, try to add new one")
            }
            if (isAuth && (access_token === null || access_token === undefined)) {
                throw new Error("Invalid access token when setting param isAuth is true")
            }

            let header: any = {
                'Content-Type': 'application/json',
            };
            if (isAuth) {
                header['Authorization'] = `Bearer ${access_token}`
            }
            const response = await fetch(`${url}&key=${key}`, {
                method: "GET",
                headers: header
            })
            data = await response.json();

            if (data.error && data.error.errors[0].reason === "quotaExceeded") {
                const temp = this.youtube_api_key;
                const indexx = temp.findIndex((item: youtube_api_keys) => {
                    return item.api_key === key;
                })
                temp[indexx] = {
                    api_key: temp[indexx].api_key,
                    isAuth: temp[indexx].isAuth,
                    reach_quota: true,
                    date_reached: new Date().toISOString().split('T')[0]
                }
                this.youtube_api_key = temp;
            }
            else if (data.error === null || data.error === undefined) {
                done = true;
            }
        }
        return data;
    }

    async fetch_youtube_user(access_token: string = ''): Promise<any> {
        const url = `https://youtube.googleapis.com/youtube/v3/channels?part=snippet%2CcontentDetails%2Cstatistics&mine=true`
        try {
            const data = await this.fetch_data(url, true, access_token)
            return {
                type: "youtube:user",
                name: data.items[0].snippet.title,
                thumbnail: data.items[0].snippet.thumbnails.default.url
            };
        }
        catch (e) {
            throw new Error(e);
        }
    }

    async gettoken(token: string): Promise<{
        access_token: string | null,
        refresh_token: string | null,
        expires_in: number | null
    }> {
        try {
            const ticket = await fetch(`https://oauth2.googleapis.com/token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    client_id: this.google_client as string,
                    client_secret: this.google_client_secret as string,
                    redirect_uri: `http://localhost:${this.port}`,
                    grant_type: 'authorization_code',
                    code: token,
                })
            });
            const data = await ticket.json();
            return data;
        } catch (e) {
            throw new Error(e);
        }
    }

    refreshYoutubeToken(token: string) {
        return new Promise(async (resolve, reject) => {
            try {
                const url = `https://oauth2.googleapis.com/token?refresh_token=${token}&client_id=${this.google_client}&client_secret=${this.google_client_secret}&grant_type=refresh_token`;

                const payload = {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                }
                const body = await fetch(url, payload);
                const response: any = await body.json();
                if (response.error) {
                    console.log(response.error);
                    resolve({
                        access_token: null,
                        refresh_token_expires_in: null,
                        expires: null
                    });
                }
                else {
                    resolve({
                        access_token: response.access_token,
                        refresh_token_expires_in: new Date().getTime() + response.refresh_token_expires_in * 1000,
                        expires: new Date().getTime() + response.expires_in * 1000
                    });
                }

            } catch (e) {
                throw new Error(e);
            }
        })
    }

    async fetch_youtube_user_playlist(access_token: string = ''): Promise<UserPlaylist> {
        let pagetoken: string = '';
        const tracks: any[] = [];
        try {
            while (pagetoken !== null && pagetoken !== undefined) {
                const url = `https://youtube.googleapis.com/youtube/v3/playlists?part=snippet%2CcontentDetails&mine=true&maxResults=${this.maxResults}&pageToken=${pagetoken}`
                const video = await this.fetch_data(url, true, access_token);
                tracks.push(...video.items.map((item: any) => {
                    return {
                        playlistName: item.snippet.title,
                        playlistId: item.id,
                        authorName: item.snippet.channelTitle,
                        thumbnail: item.snippet.thumbnails.default.url
                    }
                }))
                pagetoken = video.nextPageToken;
            }
            return {
                type: "youtube:userplaylists",
                playlists: tracks
            }
        }
        catch (e) {
            throw new Error(e);
        }
    }

    async fetchLikedVideos(access_token: string): Promise<any> {
        let pagetoken: string = '';
        const tracks: any[] = [];

        try {
            while (pagetoken !== null && pagetoken !== undefined) {
                const url = `https://youtube.googleapis.com/youtube/v3/videos?part=snippet%2CcontentDetails&maxResults=${this.maxResults}&myRating=like&pageToken=${pagetoken}`;
                const video = await this.fetch_data(url, true, access_token)

                tracks.push(...video.items.map((item: any) => {
                    return {
                        type: "youtube:track",
                        thumbnail: item.snippet.thumbnails.default.url || "",
                        artists: [{
                            name: item.snippet.channelTitle
                        }],
                        track: {
                            name: item.snippet.title,
                            id: item.id,
                            duration: this.iso8601DurationToMilliseconds(item.contentDetails.duration), // in miliseconds
                            releaseDate: item.snippet.publishedAt.split("T")[0],
                        }
                    }
                }))

                pagetoken = video.nextPageToken;
            }

            return {
                type: "youtube:playlists",
                thumbnail: "",
                name: "liked songs",
                duration: 0,
                id: "",
                tracks: tracks
            }
        }
        catch (e) {
            throw new Error(e);
        }
    }

    async fetch_youtube_playlist_data(id: string, access_token: string = ''): Promise<string | null> {
        const url = `https://youtube.googleapis.com/youtube/v3/playlists?part=snippet%2CcontentDetails&id=${id}&maxResults=25&fields=items.snippet.title`
        let data = await this.fetch_data(url, (access_token !== ""), (access_token !== "") ? access_token : null)
        return data.items[0].snippet.title || null;
    }

    async fetchPlaylistVideos(id: string = '', access_token: string = ''): Promise<Playlist> {
        let pagetoken: string = '';
        const tracks: any[] = [];

        try {
            let thumbnail: string = "";
            while (pagetoken !== null && pagetoken !== undefined) {
                const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&maxResults=${this.maxResults}&playlistId=${id}&pageToken=${pagetoken}`;
                const video = await this.fetch_data(url, (access_token !== ""), (access_token !== "") ? access_token : null);

                if (thumbnail === "") {
                    thumbnail = video.items[0].snippet.thumbnails.default.url;
                }

                for (const item of video.items.filter((item: any) => {
                    return item.snippet.description !== "This video is private." && item.snippet.description !== "This video is unavailable.";
                })) {
                    tracks.push({
                        type: "youtube:track",
                        thumbnail: item.snippet.thumbnails.default.url || "",
                        artists: [
                            {
                                name: item.snippet.videoOwnerChannelTitle
                            }
                        ],
                        track: {
                            name: item.snippet.title,
                            id: item.snippet.resourceId.videoId,
                            releaseDate: item.snippet.publishedAt.split("T")[0],
                        }
                    } as any)
                }
                pagetoken = video.nextPageToken
            }
            const name = await this.fetch_youtube_playlist_data(id, access_token)

            return {
                type: "youtube:playlist",
                thumbnail: thumbnail,
                name: name as string,
                id: id,
                tracks: tracks
            }
        }
        catch (e) {
            throw new Error(e);
        }
    }

    iso8601DurationToMilliseconds(durationString: string): number {
        const pattern = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/;
        const match = durationString.match(pattern);

        if (!match) {
            return NaN; // Invalid format
        }

        const hours = parseInt(match[1]) || 0;
        const minutes = parseInt(match[2]) || 0;
        const seconds = parseInt(match[3]) || 0;

        const totalSeconds = (hours * 3600) + (minutes * 60) + seconds;
        return totalSeconds * 1000;
    }

    async getdurations(ids: string[]): Promise<any[]> {
        const durations: any[] = [];
        let st = 0, ed = 49;
        if (ed > ids.length - 1) {
            ed = ids.length - 1;
        }

        try {
            while (st <= ids.length - 1) {
                const url = `https://youtube.googleapis.com/youtube/v3/videos?part=contentDetails&id=${ids.slice(st, ed + 1).join("%2C")}&fields=items(contentDetails.duration%20%2C%20id)`
                const data: any = await this.fetch_data(url, false);
                durations.push(...data.items.map((item: any) => {
                    return {
                        id: item.id,
                        duration: this.iso8601DurationToMilliseconds(item.contentDetails.duration)

                    }
                }))
                st = ed + 1;
                ed = st + 49;
                if (ed > ids.length - 1) {
                    ed = ids.length - 1;
                }
            }
            return durations;
        }
        catch (e) {
            throw new Error(e);
        }
    }

    async getcontentRating(ids: string[]): Promise<any> {
        const durations: any = {};
        let st = 0, ed = 49;
        if (ed > ids.length - 1) {
            ed = ids.length - 1;
        }

        try {
            while (st <= ids.length - 1) {
                const url = `https://youtube.googleapis.com/youtube/v3/videos?part=contentDetails&id=${ids.slice(st, ed + 1).join("%2C")}&fields=items(contentDetails.contentRating%20%2C%20id)`

                const data: any = await this.fetch_data(url, false);
                (data.items as any[]).forEach((item: any) => {
                    durations[item.id] = item.contentDetails.contentRating
                })
                st = ed + 1;
                ed = st + 49;
                if (ed > ids.length - 1) {
                    ed = ids.length - 1;
                }
            }
            return durations;
        }
        catch (e) {
            throw new Error(e);
        }
    }

    async fetchVideos(id: string = ''): Promise<Track> {
        const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet%2CcontentDetails&id=${id}`;
        try {
            const data: any = await this.fetch_data(url, false);
            const video = data.items[0];
            return {
                type: "youtube:track",
                thumbnail: video.snippet.thumbnails.default.url || "",
                artists: [
                    {
                        name: video.snippet.channelTitle,
                    }
                ],
                track: {
                    name: video.snippet.title,
                    id: video.id,
                    duration: this.iso8601DurationToMilliseconds(video.contentDetails.duration), // in miliseconds
                    releaseDate: video.snippet.publishedAt.split("T")[0],
                }
            } as Track
        }
        catch (e) {
            throw new Error(e);
        }
    }

    async search_youtube_video(search: string = ''): Promise<Search> {
        const url = `https://youtube.googleapis.com/youtube/v3/search?part=snippet&maxResults=30&q=${encodeURIComponent(search)}`
        try {
            let data: any[] | any = await this.fetch_data(url, false)
            const durations: any[] = await this.getdurations(data.items?.filter((item: any) => {
                return item.id.kind === "youtube#video";
            }).slice(0, 25).map((item: any) => { return item.id.videoId }) || [])

            return {
                type: "youtube:search",
                tracks: data.items
                    .filter((item: any) => {
                        return item.id.kind === "youtube#video";
                    })
                    .slice(0, 25)
                    .map((item: any, index: number) => {
                        return {
                            type: "youtube:track",
                            thumbnail: item.snippet.thumbnails.default.url || "",
                            artists: [{
                                name: item.snippet.channelTitle
                            }],
                            track: {
                                name: item.snippet.title,
                                id: item.id.videoId,
                                duration: durations[index].duration || 0, // in miliseconds
                                releaseDate: item.snippet.publishedAt,
                            }
                        } as Track
                    })
            }
        }
        catch (e) {
            throw new Error(e);
        }
    }

    async findMatchingVideo(trackToMatch: Track): Promise<Track | null> {

        const trackName = trackToMatch.track?.name || "";
        const artistName = (trackToMatch.artists as any)[0].name || "";
        const trackDuration: number = trackToMatch.track?.duration as number; // in ms

        if (!trackName || !artistName) {
            throw new Error("Track name or artist is missing.");
        }

        // A good search query using the track name and artist.
        const searchQuery = `${trackName} ${artistName}`;

        try {
            let searchResults = (await this.search_youtube_video(searchQuery)).tracks as Track[];

            const ids: string[] = searchResults.map((track: Track) => {
                return track.track?.id || ""
            })

            const contentRating = await this.getcontentRating(ids);

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

            return bestMatch;
        }
        catch (e) {
            throw new Error(e);
        }
    }

    async fetch_user_sub_channel(access_token: string = ''): Promise<User_Artist> {
        let pageToken: string = "";
        const artists: Artist[] = [];

        try {
            while (pageToken !== null && pageToken !== undefined) {
                const url = `https://youtube.googleapis.com/youtube/v3/subscriptions?part=snippet%2CcontentDetails&maxResults=${this.maxResults}&mine=true&fields=nextPageToken%2Citems(snippet(title%2Cthumbnails%2CresourceId(channelId)))&pageToken=${pageToken}`;
                const data = await this.fetch_data(url, (access_token !== ""), (access_token !== "") ? access_token : null);

                for (const item of data.items.filter((item: any) => {
                    return item.snippet.description !== "This video is private." && item.snippet.description !== "This video is unavailable.";
                })) {
                    artists.push({
                        type: "youtube:artist",
                        thumbnail: item.snippet.thumbnails.default.url || "",
                        name: item.snippet.title,
                        id: item.snippet.resourceId.channelId
                    } as any)
                }

                pageToken = data.nextPageToken
            }
            return {
                type: "youtube:artists",
                artists: artists
            };
        }
        catch (e) {
            throw new Error(e);
        }

    }

    async fetch_artist(id: string): Promise<Artist> {
        try {
            const url = `https://youtube.googleapis.com/youtube/v3/channels?part=snippet%2CcontentDetails%2Cstatistics&id=${id}`;
            const item = (await this.fetch_data(url, false) as any).items[0];
            const playlist_id = item.contentDetails.relatedPlaylists.uploads;
            return {
                type: "youtube:artist",
                name: item.snippet.title,
                id: item.id,
                tracks: (await this.fetchPlaylistVideos(playlist_id)).tracks as Track[],
                thumbnail: item.snippet.thumbnails.default.url || ""
            }
        }
        catch (e) {
            throw new Error(e);
        }

    }
}