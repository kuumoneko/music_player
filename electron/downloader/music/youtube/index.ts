import { Artist, Music_options, Playlist, Search, Track, UserPlaylist, youtube_api_keys } from "../../../types/index.js";

export default class Youtube {
    private maxResults = 200;
    private youtube_api_key: youtube_api_keys[];
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
            const response = await fetch(`${url}&key=${key}`, {
                method: "GET",
                headers: {
                    'Authorization': `Bearer ${access_token}`,
                    'Content-Type': 'application/json',
                }
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
                }
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
            return {
                type: "error",
                message: e
            }
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
        } catch (error) {
            console.error("Error verifying Google ID token:", error);
            return {
                access_token: null,
                refresh_token: null,
                expires_in: null
            };
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

            } catch (error) {
                console.error("Error refresh Youtube ID token:", error);
                resolve({
                    access_token: null,
                    refresh_token_expires_in: null,
                    expires: null
                });
            }
        })
    }


    async fetch_youtube_user_playlist(access_token: string = '', pagetoken: string = ''): Promise<UserPlaylist> {
        const url = `https://youtube.googleapis.com/youtube/v3/playlists?part=snippet%2CcontentDetails&mine=true&maxResults=${this.maxResults}&pageToken=${pagetoken}`
        try {
            let video = await this.fetch_data(url, true, access_token);

            const tracks: any[] = video.items.map((item: any) => {
                return {
                    playlistName: item.snippet.title,
                    playlistId: item.id,
                    authorName: item.snippet.channelTitle,
                    thumbnail: item.snippet.thumbnails.default.url
                }
            })

            while (video.nextPageToken) {
                const url = `https://youtube.googleapis.com/youtube/v3/videos?part=snippet%2CcontentDetails&maxResults=${this.maxResults}&myRating=like&pageToken=${video.nextPageToken}`;
                video = await this.fetch_data(url, true, access_token);

                tracks.push(...video.items.map((item: any) => {
                    // fix here
                    return {
                        playlistName: item.snippet.title,
                        playlistId: item.id,
                        authorName: item.snippet.channelTitle,
                        thumbnail: item.snippet.thumbnails.default.url
                    }
                }))
            }

            return {
                type: "youtube:userplaylists",
                playlists: tracks
            }
        }
        catch (e) {
            console.log(e);
            return {
                type: "youtube:userplaylists",
                error: e
            }
        }
    }



    async fetchLikedVideos(access_token: string, pagetoken: string = ''): Promise<any> {
        const url = `https://youtube.googleapis.com/youtube/v3/videos?part=snippet%2CcontentDetails&maxResults=${this.maxResults}&myRating=like&pageToken=${pagetoken}`;

        try {
            let video = await this.fetch_data(url, true, access_token)

            const tracks: any[] = video.items.map((item: any) => {
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
            });

            while (video.nextPageToken) {
                const url = `https://youtube.googleapis.com/youtube/v3/videos?part=snippet%2CcontentDetails&maxResults=${this.maxResults}&myRating=like&pageToken=${video.nextPageToken}`;
                video = await this.fetch_data(url, true, access_token)

                tracks.push(...video.items.map((item: any) => {
                    return {
                        type: "youtube:track",
                        thumbnail: item.snippet.thumbnails.default.url || "",
                        artists: [{
                            name: item.snippet.channelTitle
                        }],
                        track: {
                            name: item.title,
                            id: item.id,
                            duration: this.iso8601DurationToMilliseconds(item.contentDetails.duration), // in miliseconds
                            releaseDate: item.snippet.publishedAt.split("T")[0],
                        }
                    }
                }))
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
            console.log(e);
            return {
                type: "youtube:playlists",
                error: e
            }
        }
    }


    async fetch_youtube_playlist_data(id: string, access_token: string = ''): Promise<string | null> {
        const url = `https://youtube.googleapis.com/youtube/v3/playlists?part=snippet%2CcontentDetails&id=${id}&maxResults=25&fields=items.snippet.title`
        let data = await this.fetch_data(url, (access_token !== ""), (access_token !== "") ? access_token : null)
        return data.items[0].snippet.title || null;
    }


    async fetchPlaylistVideos(id: string = '', access_token: string = '', pagetoken: string = ''): Promise<Playlist> {

        const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&maxResults=${this.maxResults}&playlistId=${id}&pageToken=${pagetoken}`;
        try {
            let video = await this.fetch_data(url, (access_token !== ""), (access_token !== "") ? access_token : null)

            const thumbnail = video.items[0].snippet.thumbnails.default.url;

            const tracks: Track[] = [];
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


            while (video.nextPageToken) {
                const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&maxResults=${this.maxResults}&playlistId=${id}&pageToken=${video.nextPageToken}`;

                video = await this.fetch_data(url, (access_token !== ""), (access_token !== "") ? access_token : null)

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
            console.log(e);
            return {
                type: "youtube:playlist",
                error: e
            }
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
            console.log(e);
            return [];
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
            console.log(e);
            return null
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
            console.log(e);
            return {
                type: "youtube:track",
                error: e
            }
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
            console.log(e);
            return {
                type: "youtube:search",
                error: e
            }
        }
    }

    async findMatchingVideo(trackToMatch: Track): Promise<Track | null> {

        const trackName = trackToMatch.track?.name || "";
        const artistName = (trackToMatch.artists as any)[0].name || "";
        const trackDuration: number = trackToMatch.track?.duration as number; // in ms

        if (!trackName || !artistName) {
            console.error("Track name or artist is missing.");
            return null;
        }

        // A good search query using the track name and artist.
        const searchQuery = `${trackName} ${artistName}`;

        try {
            let searchResults = (await this.search_youtube_video(searchQuery)).tracks as Track[]

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

            const DURATION_TOLERANCE_MS = 60 * 1000; // 60 seconds tolerance for scoring

            for (const ytVideo of result_track) {
                const durationDifference = Math.abs(ytVideo.track.duration as number - trackDuration);

                // Heuristic: ignore videos with a huge duration difference
                if (durationDifference > DURATION_TOLERANCE_MS) { // 30 seconds
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

                // console.log(ytVideo.track.id, ' ', ytVideo.track.contentRating)
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
            console.log(e);;
            return null
        }
    }

    async fetch_user_sub_channel(access_token: string = ''): Promise<Artist[]> {
        const url = `https://youtube.googleapis.com/youtube/v3/subscriptions?part=snippet%2CcontentDetails&maxResults=${this.maxResults}&mine=true&fields=nextPageToken%2Citems(snippet(title%2Cthumbnails%2CresourceId(channelId)))`;
        // let data = await this.fetch_data(url, true, access_token);

        try {

            let data = await this.fetch_data(url, (access_token !== ""), (access_token !== "") ? access_token : null)

            const artists: Artist[] = [];
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


            while (data.nextPageToken) {
                const url = `https://youtube.googleapis.com/youtube/v3/subscriptions?part=snippet&maxResults=${this.maxResults}&mine=true&fields=nextPageToken%2Citems(snippet(title%2Cthumbnails%2CresourceId(channelId)))&pageToken=${data.nextPageToken}`;

                data = await this.fetch_data(url, (access_token !== ""), (access_token !== "") ? access_token : null)

                for (const item of data.items.filter((item: any) => {
                    return item.snippet.description !== "This video is private." && item.snippet.description !== "This video is unavailable.";
                })) {
                    artists.push({
                        type: "youtube:artist",
                        thumbnail: item.snippet.thumbnails.default.url || "",

                    } as any)
                }
            }

            return artists;
        }
        catch (e) {
            console.log(e);
            return [
                {
                    error: e,
                    name: ""
                }
            ]
        }

    }

}