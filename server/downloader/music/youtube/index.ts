import { Mode, Music_options, Playlist, Search, Track } from "../types.ts";

export default class Youtube {
    private maxResults = 200;

    private youtube_api_key: string[] | undefined;
    private google_client: string | undefined;
    private google_client_secret: string | undefined;
    private redirect_uris: string[] = []
    private mode: Mode;

    constructor(options: Music_options, mode: Mode) {
        // client API
        this.youtube_api_key = options.youtube_api_key;
        this.google_client = options.google_client_id;
        this.google_client_secret = options.google_client_secret;
        this.redirect_uris = options.redirect_uris || []
        this.mode = mode;
    }

    async fetch_youtube_user(access_token: string = ''): Promise<any> {
        // await this.get_token();
        // console.log(access_token)
        const url = `https://youtube.googleapis.com/youtube/v3/channels?part=snippet%2CcontentDetails%2Cstatistics&mine=true&key=${this.youtube_api_key ? this.youtube_api_key[0] : ''}`
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${access_token}` },
        });
        const data = await response.json();
        // console.log(data)
        return {
            type: "youtube:user",
            name: data.items[0].snippet.title,
            thumbnail: data.items[0].snippet.thumbnails.default.url
        };
    }

    // create a functino return a random item in string[]
    randomm(list: string[]) {
        const max = list?.length as number - 1,
            min = 0;
        const random = Math.floor(Math.random() * (max - min + 1)) + min;
        return list[random];
    }


    async gettoken(token: string) {
        try {
            // console.log({
            //     client_id: this.google_client,
            //     client_secret: this.google_client_secret,
            //     redirect_uri: (this.mode === Mode.deploy) ? this.redirect_uris[0] : this.redirect_uris[1],
            //     grant_type: 'authorization_code',
            //     code: token,
            // })
            const ticket = await fetch(`https://oauth2.googleapis.com/token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    client_id: this.google_client as string,
                    client_secret: this.google_client_secret as string,
                    redirect_uri: (this.mode === Mode.deploy) ? this.redirect_uris[0] : this.redirect_uris[1],
                    grant_type: 'authorization_code',
                    code: token,
                })
            });
            const data = await ticket.json();
            // console.log(data)
            return data;
        } catch (error) {
            console.error("Error verifying Google ID token:", error);
            return null;
        }
    }

    refreshYoutubeToken(token: string) {
        return new Promise(async (resolve, reject) => {
            try {
                // const clientId = this.spotify_client_id; // Replace with your client ID
                // const clientSecret = this.spotify_api_key; // Replace with your client secret
                const url = `https://oauth2.googleapis.com/token?refresh_token=${token}&client_id=${this.google_client}&client_secret=${this.google_client_secret}&grant_type=refresh_token`;

                const payload = {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                }
                const body = await fetch(url, payload);
                const response = await body.json();
                resolve({
                    access_token: response.access_token,
                    refresh_token_expires_in: new Date().getTime() + response.refresh_token_expires_in * 1000,
                    expires: new Date().getTime() + response.expires_in * 1000
                });
            } catch (error) {
                console.error("Error refresh Spotify ID token:", error);
                resolve(null);
            }
        })
    }


    async fetch_youtube_user_playlist(access_token: string = '', pagetoken: string = ''): Promise<any> {
        // await this.get_token();
        // console.log(access_token)
        const url = `https://youtube.googleapis.com/youtube/v3/playlists?part=snippet%2CcontentDetails&mine=true&maxResults=${this.maxResults}&key=${this.youtube_api_key ? this.youtube_api_key[0] : ""}&pageToken=${pagetoken}`
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${access_token}` },
        });
        let video = await response.json();


        // const thumbnail = video.items[0].snippet.thumbnails.default.url;

        const tracks: any[] = video.items.map((item: any) => {
            return {
                playlistName: item.snippet.title,
                playlistId: item.id,
                authorName: item.snippet.channelTitle,
                thumbnail: item.snippet.thumbnails.default.url
            }
        })

        while (video.nextPageToken) {
            const url = `https://youtube.googleapis.com/youtube/v3/videos?part=snippet%2CcontentDetails&maxResults=${this.maxResults}&myRating=like&key=${this.youtube_api_key ? this.youtube_api_key[0] : ""}&pageToken=${video.nextPageToken}`;
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${access_token}`,
                    'Content-Type': 'application/json',
                },
            });
            video = await response.json();
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
            // thumbnail: thumbnail,
            playlists: tracks
        }
    }



    async fetchLikedVideos(access_token: string, pagetoken: string = ''): Promise<any> {
        // 
        const url = `https://youtube.googleapis.com/youtube/v3/videos?part=snippet%2CcontentDetails&maxResults=${this.maxResults}&myRating=like&key=${this.youtube_api_key ? this.youtube_api_key[0] : ""}&pageToken=${pagetoken}`;
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${access_token}`,
                'Content-Type': 'application/json',
            },
        });
        let video = await response.json();



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
            const url = `https://youtube.googleapis.com/youtube/v3/videos?part=snippet%2CcontentDetails&maxResults=${this.maxResults}&myRating=like&key=${this.youtube_api_key ? this.youtube_api_key[0] : ""}&pageToken=${video.nextPageToken}`;
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${access_token} `,
                    'Content-Type': 'application/json',
                },
            });
            video = await response.json();
            tracks.push(...video.items.map((item: any) => {
                // fix here
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


    async fetch_youtube_playlist_data(id: string, access_token: string = '') {

        const headers = (access_token !== "") ? {
            'Authorization': `Bearer ${access_token}`,
            'Content-Type': 'application/json',
        } : {
            'Content-Type': 'application/json',
        }

        const key = (access_token !== "" && this.youtube_api_key) ? this.youtube_api_key[0] as string : this.randomm(this.youtube_api_key?.slice(1) as string[]);



        const url = `https://youtube.googleapis.com/youtube/v3/playlists?part=snippet%2CcontentDetails&id=${id}&maxResults=25&fields=items.snippet.title&key=${key}`
        const response = await fetch(url, {
            headers: headers as HeadersInit
        });
        let data = await response.json();
        // console.log(data.items[0])
        return data.items[0].snippet.title;
    }


    async fetchPlaylistVideos(id: string = '', access_token: string = '', pagetoken: string = ''): Promise<Playlist> {

        const headers = (access_token !== "") ? {
            'Authorization': `Bearer ${access_token}`,
            'Content-Type': 'application/json',
        } : {
            'Content-Type': 'application/json',
        }

        const key = (access_token !== "" && this.youtube_api_key) ? this.youtube_api_key[0] as string : this.randomm(this.youtube_api_key?.slice(1) as string[]);


        // console.log


        const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&maxResults=${this.maxResults}&playlistId=${id}&key=${key}&pageToken=${pagetoken}`;
        const response = await fetch(url, {
            headers: headers as HeadersInit
        });
        let video = await response.json();

        // console.log(video)


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
            const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&maxResults=${this.maxResults}&playlistId=${id}&key=${key}&pageToken=${video.nextPageToken}`;
            const response = await fetch(url, {
                headers: headers as HeadersInit
            });
            video = await response.json();
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

        // const ids: string[] = tracks.map((track: any) => { return track.track.id; });

        // const durations: any[] = await this.getdurations(ids);
        const name = await this.fetch_youtube_playlist_data(id, access_token)

        return {
            type: "youtube:playlist",
            thumbnail: thumbnail,
            name: name,
            // duration: durations.map((item) => item.duration).reduce((a: number, b: number) => a + b, 0),
            id: id,
            tracks: tracks
        } as any
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

        while (st <= ids.length - 1) {
            const get_duration = await fetch(`https://youtube.googleapis.com/youtube/v3/videos?part=contentDetails&id=${ids.slice(st, ed + 1).join("%2C")}&key=${this.randomm(this.youtube_api_key?.slice(1) as string[])}&fields=items(contentDetails.duration%20%2C%20id)`, {
                headers: {
                    "Content-Type": "application/json",
                }
            })

            const data = await get_duration.json();

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

    async fetchVideos(id: string = ''): Promise<Track> {
        const pagetoken = '';
        const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet%2CcontentDetails&id=${id}&key=${this.randomm(this.youtube_api_key?.slice(1) as string[])}&pageToken=${pagetoken}`;

        const response = await fetch(url);
        const data = await response.json();
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

    // https://youtube.googleapis.com/youtube/v3/search?part=snippet&maxResults=30&q=Xe%20%C4%90%E1%BA%A1p%20Th%C3%B9y%20Chi&key=AIzaSyA0jwZ5rah9kfz0BDbui6ls-wX2G6pcMqg
    // https://youtube.googleapis.com/youtube/v3/search?part=snippet&maxResults=25&q=Xe%20%C4%90%E1%BA%A1p%20Th%C3%B9y%20Chi&key=AIzaSyA0jwZ5rah9kfz0BDbui6ls-wX2G6pcMqg

    async search_youtube_video(search: string = ''): Promise<Search> {
        const pagetoken = '';
        // https://youtube.googleapis.com/youtube/v3/search?part=snippet&maxResults=25&q=surfing&key=AIzaSyA0jwZ5rah9kfz0BDbui6ls-wX2G6pcMqg
        const url = `https://youtube.googleapis.com/youtube/v3/search?part=snippet&maxResults=30&q=${encodeURIComponent(search)}&key=${this.randomm(this.youtube_api_key?.slice(1) as string[])}`
        const response = await fetch(url);
        let data: any[] | any = await response.json();

        // console.log(url)


        const durations: any[] = await this.getdurations(data.items?.filter((item: any) => {
            return item.id.kind === "youtube#video";
        }).slice(0, 25).map((item: any) => { return item.id.videoId }) || [])

        // console.log(data)

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

    /**
     * Finds a YouTube video that is the closest match to a given track (e.g., from Spotify).
     * It constructs a search query from the track's name and artist, then scores the
     * search results based on title, channel, and duration similarity.
     *
     * @param trackToMatch The track to find a corresponding YouTube video for. Must conform to the Track type.
     * @returns A `Track` object for the best matching YouTube video, or `null` if no suitable match is found.
     */
    async findMatchingVideo(trackToMatch: Track): Promise<Track | null> {





        const trackName = trackToMatch.track.name;
        const artistName = trackToMatch.artists[0]?.name;
        const trackDuration: number = trackToMatch.track.duration as number; // in ms

        if (!trackName || !artistName) {
            console.error("Track name or artist is missing.");
            return null;
        }

        // A good search query using the track name and artist.
        const searchQuery = `${trackName} ${artistName}`;
        const searchResults = await this.search_youtube_video(searchQuery);

        if (!searchResults || searchResults.tracks.length === 0) {
            return null;
        }

        let bestMatch: Track | null = null;
        let bestScore = -1;

        const DURATION_TOLERANCE_MS = 60 * 1000; // 10 seconds tolerance for scoring

        for (const ytVideo of searchResults.tracks) {
            const durationDifference = Math.abs(ytVideo.track.duration as number - trackDuration);

            // Heuristic: ignore videos with a huge duration difference
            if (durationDifference > DURATION_TOLERANCE_MS) { // 30 seconds
                continue;
            }

            let score = 0;
            const videoTitle = ytVideo.track.name.toLowerCase();
            const channelTitle = ytVideo.artists[0]?.name.toLowerCase();
            const lowerCaseArtistName = artistName.toLowerCase();

            // Score based on title keywords and channel name
            if (videoTitle.includes(trackName.toLowerCase())) score += 2;
            if (channelTitle.includes(lowerCaseArtistName)) score += 3; // Strong indicator
            else if (videoTitle.includes(lowerCaseArtistName)) score += 1;

            if (videoTitle.includes("official audio") || videoTitle.includes("art track")) score += 5;
            else if (videoTitle.includes("official video") || videoTitle.includes("official music video")) score += 3;
            else if (videoTitle.includes("lyrics")) score += 2;

            // Add score based on duration proximity
            if (durationDifference < DURATION_TOLERANCE_MS) {
                score += (5 * (1 - (durationDifference / DURATION_TOLERANCE_MS)));
            }

            if (score > bestScore) {
                bestScore = score;
                bestMatch = ytVideo;
            }
        }

        return bestMatch;
    }

}