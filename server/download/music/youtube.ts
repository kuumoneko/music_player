import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { Artist, EndPoints, Music_options, Playlist, Search, Track, User_Artist, UserPlaylist, youtube_api_keys, youtube_endpoint, youtube_endpoints } from "../../types/index.js";
import iso8601DurationToMilliseconds from "./utils/formatTime.js";

export default class Youtube {
    private maxResults = 50;
    public youtube_api_key: youtube_api_keys[];
    private google_client: string | undefined;
    private google_client_secret: string | undefined;
    private port: number = 3000;
    private endpoints: youtube_endpoints = undefined as any;
    private database: string;
    private running: any[] = [];

    constructor(options: Music_options) {
        // client API
        this.youtube_api_key = options.youtube_api_key || [];
        this.google_client = options.google_client_id;
        this.google_client_secret = options.google_client_secret;
        this.port = options.port || 3000;
        this.database = options.database;
        this.endpoints = options.endpoints as any;
        if (this.endpoints === undefined) {
            this.endpoints = this.getdata("endpoint");
        }
    }

    getRandomItem(list: any[]) {
        const randomIndex = Math.floor(Math.random() * list.length);
        return list[randomIndex];
    }

    chose_api_key(isAuth: boolean) {
        const temp = this.youtube_api_key.filter((item: youtube_api_keys) => {
            return item.isAuth === isAuth && item.reach_quota === false
        })
        return this.getRandomItem(temp).api_key
    }

    async fetch_data(
        url: string,
        isAuth: boolean,
        access_token?: string | null,
        etag?: string
    ) {
        let done = false;
        let data: any;
        while (!done) {
            const key = this.chose_api_key(isAuth);
            if (key?.length === 0 || key === undefined || key === null) {
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
            if (etag && etag.length > 0) {
                header["If-None-Match"] = etag
            }
            const response = await fetch(`${url}&key=${key}`, {
                method: "GET",
                headers: header
            })
            if (response.status === 304 && response.statusText === "Not Modified") {
                data = null
                done = true
            }
            else {
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
                        date_reached: new Date().toISOString().split('T')[0],
                        time_reached: new Date().toISOString().split("T")[1].split(".")[0]
                    }
                    this.youtube_api_key = temp;
                }
                else if (data.error === null || data.error === undefined) {
                    done = true;
                }
                else {
                    throw new Error(data.error)
                }
            }
        }
        return data;
    }

    create_end_point(endpoint: youtube_endpoint) {
        let url = endpoint.url + "?" + new URLSearchParams(endpoint.params).toString();
        return url;
    }

    getdata(...args: string[]) {
        try {
            const filename = args[args.length - 1]
            return JSON.parse(readFileSync(path.join(this.database, ...args.slice(0, -1), `${filename}.json`), { encoding: "utf-8" }));
        }
        catch (e) {
            return undefined
        }
    }

    writedata(...args: any[]) {
        const filename = args[args.length - 2];
        const data = args[args.length - 1];

        writeFileSync(path.join(this.database, ...args.slice(0, -2), `${filename}.json`), JSON.stringify(data), { encoding: "utf-8" });
    }

    async get_me(access_token: string = ''): Promise<any> {
        if (this.running.filter((item: any) => { item.name === `me` }).length === 0) {
            this.running.push({
                name: "me"
            })
        } else {
            return;
        }
        const url = this.create_end_point(this.endpoints[EndPoints.User]);
        try {
            const data = await this.fetch_data(url, true, access_token);
            this.running = this.running.filter((item: { name: string }) => { return item.name !== "me" })
            return {
                type: "youtube:user",
                name: data.items[0].snippet.title,
                thumbnail: data.items[0].snippet.thumbnails.default.url
            };
        }
        catch (e) {
            this.running = this.running.filter((item: { name: string }) => { return item.name !== "me" })
            throw new Error(e);
        }
    }

    async get_token(token: string): Promise<{
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
                    redirect_uri: `http://localhost:${this.port}/login`,
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

    async refreshYoutubeToken(token: string) {
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
                return {
                    access_token: null,
                    refresh_token_expires_in: null,
                    expires: null
                };
            }
            else {
                return {
                    access_token: response.access_token,
                    refresh_token_expires_in: new Date().getTime() + response.refresh_token_expires_in * 1000,
                    expires: new Date().getTime() + response.expires_in * 1000
                };
            }

        } catch (e) {
            throw new Error(e);
        }
    }

    async fetch_user_playlists(access_token: string = ''): Promise<UserPlaylist | null> {
        if (this.running.filter((item: any) => { item.name === `user_playlist` }).length === 0) {
            this.running.push({
                name: "user_playlist"
            })
        } else {
            return null
        }
        let pagetoken: string = '';
        const tracks: any[] = [];
        const url = `${this.create_end_point(this.endpoints[EndPoints.UserPlaylist])}&maxResults=${this.maxResults}`;
        let user = this.getdata("user", "playlist");

        try {
            let etag = (user.etag && user.etag?.length > 0) ? user.etag : undefined
            while (pagetoken !== null && pagetoken !== undefined) {
                const endpoint = url + `&pageToken=${pagetoken}`;
                const video = await this.fetch_data(endpoint, true, access_token, etag);
                if (video === null) {
                    this.running = this.running.filter((item: { name: string }) => { return item.name !== "user_playlist" })
                    return {
                        type: "youtube:userplaylists",
                        playlists: user.list
                    }
                }
                if (pagetoken === "") {
                    etag = video.etag;
                }

                tracks.push(...video.items.map((item: any) => {
                    return {
                        type: "youtube:userplaylist",
                        playlistName: item.snippet.title,
                        playlistId: item.id,
                        authorName: item.snippet.channelTitle,
                        thumbnail: item.snippet.thumbnails.default.url
                    }
                }))
                pagetoken = video.nextPageToken;
            }
            user = {
                etag: etag,
                list: tracks
            }
            this.writedata("user", "playlist", user);
            this.running = this.running.filter((item: { name: string }) => { return item.name !== "user_playlist" })
            return {
                type: "youtube:userplaylists",
                playlists: tracks
            }
        }
        catch (e) {
            this.running = this.running.filter((item: { name: string }) => { return item.name !== "user_playlist" })
            throw new Error(e);
        }
    }

    async fetch_liked_tracks(access_token: string): Promise<any> {
        return new Promise(async (resolve, reject) => {
            let user = this.getdata("user", "likedsongs");

            let etag = (user.etag && user.etag?.length > 0) ? user.etag : undefined

            const ids: string[] = user.lists ?? [];

            if (ids.length > 0) {
                resolve({
                    type: "youtube:playlists",
                    thumbnail: "",
                    name: "liked songs",
                    duration: 0,
                    id: "",
                    tracks: await this.fetch_track(ids)
                })
            }

            if (!etag || etag.length === 0) {
                if (this.running.filter((item: any) => { item.name === `liked_tracks` }).length === 0) {
                    this.running.push({
                        name: "liked_tracks"
                    })
                } else {
                    return null;
                }
                let pagetoken: string = '';
                const url = `${this.create_end_point(this.endpoints[EndPoints.LikedSongs])}&maxResults=${this.maxResults}`;

                while (pagetoken !== null && pagetoken !== undefined) {
                    const endpoint = url + `&pageToken=${pagetoken}`;
                    const video = await this.fetch_data(endpoint, true, access_token, etag);

                    if (video === null) {
                        this.running = this.running.filter((item: { name: string }) => { return item.name !== "liked_tracks" })
                        const tracks = await this.fetch_track(user.lists);
                        return {
                            type: "youtube:playlists",
                            thumbnail: "",
                            name: "liked songs",
                            duration: 0,
                            id: "",
                            tracks: tracks
                        }
                    }
                    if (pagetoken === "") {
                        etag = video.etag;
                    }
                    const temp = video.items.map((item: any) => {
                        return item.id
                    })
                    ids.push(...temp);
                    user = {
                        etag: etag,
                        lists: ids
                    }
                    this.writedata("user", "likedsongs", user);

                    pagetoken = video.nextPageToken;
                }
                this.running = this.running.filter((item: { name: string }) => { return item.name !== "liked_tracks" })
            }
        })
    }

    async fetch_playlist_name(id: string, access_token: string = ''): Promise<string | null> {
        const url = `${this.create_end_point(this.endpoints[EndPoints.PlaylistData])}&id=${id}`
        let data = await this.fetch_data(url, (access_token !== ""), (access_token !== "") ? access_token : null)
        return data?.items[0]?.snippet?.title || null;
    }

    fetch_playlist(id: string, access_token: string = "", pagetoken: string = ""): Promise<Playlist> {
        return new Promise(async (resolve, reject) => {
            const tracks: string[] = [];
            const url = `${this.create_end_point(this.endpoints[EndPoints.PlaylistItem])}&maxResults=${this.maxResults}&playlistId=${id}`;
            let this_playlist = this.getdata("playlist", id) ?? { ids: [] };
            try {
                let thumbnail: string = "";
                if (this_playlist && this_playlist.ids.length > 0) {
                    const tracks = await this.fetch_track(this_playlist.ids);
                    this.writedata("playlist", id, {
                        ...this_playlist,
                        ids: tracks.map((item: Track) => { return item.track?.id })
                    })
                    resolve({
                        type: "youtube:playlist",
                        name: this_playlist.name,
                        thumbnail: this_playlist.thumbnail,
                        duration: tracks.reduce((item: number, b: Track) => item + (b.track?.duration as number), 0),
                        tracks: tracks
                    })
                }
                if (this.running.filter((item: any) => { item.name === `playlist:${id}` }).length === 0) {
                    this.running.push({
                        name: `playlist:${id}`
                    })
                } else {
                    return;
                }
                let etag = (this_playlist?.etag && this_playlist?.etag?.length > 0) ? this_playlist?.etag : undefined;
                let done = false;
                while (!done && pagetoken !== undefined && pagetoken !== null) {
                    const endpoint = url + `&pageToken=${pagetoken}`;
                    let video = await this.fetch_data(endpoint, (access_token !== ""), (access_token !== "") ? access_token : null, etag);
                    if (video === null && this_playlist.ids.length >= this_playlist.length) {
                        done = true
                        break;
                    }
                    else if (this_playlist.ids.length === video?.pageInfo?.totalResults) {
                        done = true
                        break;
                    }
                    else {
                        video = await this.fetch_data(endpoint, (access_token !== ""), (access_token !== "") ? access_token : null);
                    }

                    if (pagetoken === "") {
                        etag = video.etag
                    }

                    if (thumbnail === "") {
                        thumbnail = video.items[0].snippet.thumbnails.default.url;
                    }

                    for (const item of video.items.filter((item: any) => {
                        return item.snippet.description !== "This video is private." && item.snippet.description !== "This video is unavailable.";
                    })) {
                        tracks.push(item.snippet.resourceId.videoId)
                    }
                    this_playlist = {
                        etag: etag,
                        thumbnail: thumbnail,
                        name: this_playlist.name ?? await this.fetch_playlist_name(id, access_token),
                        ids: Array.from(new Set([...tracks, ...this_playlist.ids])),
                        length: video.pageInfo.totalResults
                    }
                    this.writedata("playlist", id, this_playlist)
                    pagetoken = video.nextPageToken
                }
                this.running = this.running.filter((item: { name: string }) => { return item.name !== `playlist:${id}` })

            }
            catch (e) {
                this.running = this.running.filter((item: { name: string }) => { return item.name !== `playlist:${id}` })
                throw new Error(e)
            }
        })
    }

    async fetch_contentRating(ids: string[]): Promise<any> {
        const durations: any = {};
        let st = 0, ed = 49;
        if (ed > ids.length - 1) {
            ed = ids.length - 1;
        }
        const url = `${this.create_end_point(this.endpoints[EndPoints.ContentRating])}`

        try {
            while (st <= ids.length - 1) {
                const endpoint = url + `&id=${ids.slice(st, ed + 1).join("%2C")}`
                const data: any = await this.fetch_data(endpoint, false);
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

    async fetch_track(ids: string[]): Promise<Track[]> {
        try {
            ids = Array.from(new Set([...ids]));
            const tracks = ids.map((id: string) => {
                return {
                    ...this.getdata("tracks", id),
                    id: id
                };
            })

            const tracks_in_database = tracks.filter(
                (id: {
                    name: string,
                    id: string
                }) => {
                    return id.name !== undefined
                }).map((item: {
                    name: string,
                    thumbnail: string,
                    duration: number,
                    artists: any[],
                    releaseDate: string,
                    music_url: any,
                    id: string
                }) => {
                    return {
                        type: "youtube:track",
                        thumbnail: item.thumbnail,
                        artists: item.artists,
                        track: {
                            name: item.name,
                            id: item.id,
                            duration: item.duration,
                            releaseDate: item.releaseDate
                        }
                    }
                })

            const tracks_out_database = tracks.filter(
                (id: {
                    name: string,
                    id: string
                }) => {
                    return id.name === undefined
                }).map((item: any) => { return item.id })

            const temp_tracks: Track[] = []
            if (tracks_out_database.length > 0) {
                let st = 0, ed = 49;
                if (ed > tracks_out_database.length - 1) {
                    ed = tracks_out_database.length - 1;
                }

                const url = `${this.create_end_point(this.endpoints[EndPoints.Videos])}`;

                while (st <= tracks_out_database.length - 1) {
                    const endpoint = url + `&id=${tracks_out_database.slice(st, ed + 1).join("%2C")}`
                    const data: any = await this.fetch_data(endpoint, false);
                    for (const item of data.items) {

                        temp_tracks.push({
                            type: "youtube:track",
                            thumbnail: item.snippet.thumbnails.default.url || "",
                            artists: [
                                {
                                    name: item.snippet.channelTitle,
                                    id: item.snippet.channelId
                                }
                            ],
                            track: {
                                name: item.snippet.title,
                                id: item.id,
                                duration: item.snippet.liveBroadcastContent === "none" ? iso8601DurationToMilliseconds(item.contentDetails.duration) : 0, // in miliseconds
                                releaseDate: item.snippet.publishedAt.split("T")[0],
                            }
                        })
                    }
                    st = ed + 1;
                    ed = st + 49;
                    if (ed > tracks_out_database.length - 1) {
                        ed = tracks_out_database.length - 1;
                    }
                }
            }

            for (const track of temp_tracks) {
                this.writedata("tracks", track.track?.id as string, {
                    name: track.track?.name as string,
                    thumbnail: track.thumbnail,
                    duration: track.track?.duration,
                    artists: track.artists,
                    releaseDate: track.track?.releaseDate,
                    music_url: null
                })
            }
            const res = [...tracks_in_database, ...temp_tracks]
            return res;
        }
        catch (e) {
            throw new Error(e);
        }
    }

    async search(search: string = ''): Promise<Search> {
        try {
            const limit: number = 100
            const endpoint = `https://www.youtube.com/results?search_query=${search}&sp=EgIQAQ%3D%3D`;

            const create_page = await fetch(encodeURI(endpoint));
            const pageData = await create_page.text();
            const ytInitData = pageData.split("var ytInitialData =");

            let page: any = null;
            if (ytInitData && ytInitData.length > 1) {
                const script_data = ytInitData[1]
                    .split("</script>")[0]
                    .slice(0, -1);
                page = JSON.parse(script_data);
            }

            if (page === null) {
                throw new Error("Unreachable code")
            }

            const sectionListRenderer = page.contents.twoColumnSearchResultsRenderer.primaryContents.sectionListRenderer;

            const ids: string[] = [];
            sectionListRenderer.contents.forEach((content: any) => {
                if (content.itemSectionRenderer) {
                    content.itemSectionRenderer.contents.forEach((item: any) => {
                        if (item.videoRenderer) {
                            const videoRender = item.videoRenderer;

                            ids.push(videoRender.videoId)
                        }
                    });
                }
            });
            const tracks = await this.fetch_track(ids)
            const itemsResult = limit !== 0 ? tracks.slice(0, limit) : tracks;
            return {
                type: "youtube:search",
                tracks: itemsResult
            }
        }
        catch (e) {
            throw new Error(e);
        }
    }

    async fetch_following_artists(access_token: string = ''): Promise<User_Artist | null> {
        if (this.running.filter((item: any) => { item.name === `following_artists` }).length === 0) {
            this.running.push({
                name: `following_artists`
            })
        } else {
            return null;
        }
        let pageToken: string = "";
        const artists: Artist[] = [];
        const url = `${this.create_end_point(this.endpoints[EndPoints.UserArtist])}&maxResults=${this.maxResults}`;
        let user = this.getdata("user", "artist");
        try {
            let etag = (user.etag && user.etag?.length > 0) ? user.etag : undefined

            while (pageToken !== null && pageToken !== undefined) {
                const endpoint = url + `&pageToken=${pageToken}`
                const data = await this.fetch_data(endpoint, (access_token !== ""), (access_token !== "") ? access_token : null, etag);

                if (data === null) {
                    this.running = this.running.filter((item: { name: string }) => { return item.name !== "following_artists" })

                    return {
                        type: "youtube:artists",
                        artists: user.list
                    }
                }

                if (pageToken === "") {
                    etag = data.etag
                }

                for (const item of data.items) {
                    artists.push({
                        type: "youtube:artist",
                        thumbnail: item.snippet.thumbnails.default.url || "",
                        name: item.snippet.title,
                        id: item.snippet.resourceId.channelId
                    } as any)
                }

                pageToken = data.nextPageToken
            }
            user = {
                etag: etag,
                list: artists
            }
            this.writedata("user", "artist", user);
            this.running = this.running.filter((item: { name: string }) => { return item.name !== `following_artists` })

            return {
                type: "youtube:artists",
                artists: artists
            };
        }
        catch (e) {
            this.running = this.running.filter((item: { name: string }) => { return item.name !== `following_artists` })

            throw new Error(e);
        }

    }

    async fetch_artist(id: string, pagetoken: string = ''): Promise<Artist | null> {
        if (this.running.filter((item: any) => { item.name === `artist:${id}` }).length === 0) {
            this.running.push({
                name: `artist:${id}`
            })
        } else {
            return null;
        }
        let this_artist = this.getdata("artist", id);
        try {
            let etag = (this_artist?.etag && this_artist.etag?.length > 0) ? this_artist?.etag : undefined
            const url = `${this.create_end_point(this.endpoints[EndPoints.Artist])}&id=${id}`;
            const item = (await this.fetch_data(url, false, undefined, etag) as any);
            if (item === null) {
                let playlist_id = this_artist.playlistId ?? "";
                if (playlist_id === "") {
                    const temping = (await this.fetch_data(url, false, undefined) as any);
                    playlist_id = temping.items[0].contentDetails.relatedPlaylists.uploads
                }
                const playlist = await this.fetch_playlist(playlist_id, undefined, pagetoken)
                const artist_tracks = playlist.tracks as Track[];
                this.writedata("artist", id, {
                    ...this_artist,
                    playlistId: playlist_id
                });
                this.running = this.running.filter((item: { name: string }) => { return item.name !== `artist:${id}` })

                return {
                    type: "youtube:artist",
                    name: this_artist.name,
                    id: this_artist.id,
                    tracks: artist_tracks,
                    thumbnail: this_artist.thumbnail,
                    playlistId: this_artist.playlistId
                }
            }
            etag = item.etag;
            const itemm = item.items[0];
            let playlist_id = itemm.contentDetails.relatedPlaylists.uploads;
            const artist_playlist = await this.fetch_playlist(playlist_id, undefined, pagetoken)
            const artist_tracks = artist_playlist.tracks as Track[];
            this_artist = {
                etag: etag,
                name: itemm.snippet.title,
                thumbnail: itemm.snippet?.thumbnails?.default?.url || "",
                videoCount: itemm.statistics.videoCount,
                playlistId: playlist_id
            }
            this.writedata("artist", id, this_artist);
            this.running = this.running.filter((item: { name: string }) => { return item.name !== `artist:${id}` })

            return {
                type: "youtube:artist",
                name: itemm.snippet.title,
                id: itemm.id,
                tracks: artist_tracks,
                thumbnail: itemm.snippet?.thumbnails?.default?.url || "",
                pagetoken: artist_playlist.pagetoken,
                playlistId: playlist_id
            }
        }
        catch (e) {
            this.running = this.running.filter((item: { name: string }) => { return item.name !== `artist:${id}` })

            throw new Error(e);
        }
    }

    async get_new_tracks(ids: string[]) {
        const new_tracks = this.getdata("new_tracks") ?? {};

        const base_playlist__url = `${this.create_end_point(this.endpoints[EndPoints.PlaylistItem])}&maxResults=${this.maxResults}`;
        const base_artist__url = `${this.create_end_point(this.endpoints[EndPoints.Artist])}`;

        const artist = async (id: string): Promise<string> => {
            let this_artist = this.getdata("artist", id) ?? {};
            const artist_url = base_artist__url + `&id=${id}`;

            const artist_etag = (this_artist?.etag && this_artist?.etag?.length > 0) ? this_artist?.etag : undefined;

            let artist = await this.fetch_data(artist_url, false, undefined, artist_etag);

            let playlistId: string = "",
                thumbnail = "", name = "";
            if (artist === null) {
                if (this_artist.playlistId && this_artist.playlistId?.length > 0) {
                    playlistId = this_artist.playlistId;
                    thumbnail = this_artist.thumbnail;
                    name = this_artist.name
                }
                else {
                    artist = await this.fetch_data(artist_url, false, null);
                }
            }
            if (artist !== null) {
                const itemm = artist.items[0];
                playlistId = itemm.contentDetails.relatedPlaylists.uploads;
                thumbnail = itemm.snippet.thumbnails.default.url || "";
                name = itemm.snippet.title;

                this_artist = {
                    etag: artist.etag,
                    name: name,
                    id: itemm.id,
                    thumbnail: thumbnail,
                    videoCount: itemm.statistics.videoCount,
                    playlistId: playlistId
                }
            }

            this.writedata("artist", id, this_artist);
            return playlistId;
        }

        const playlist = async (id: string) => {

            // check playlist
            let this_playlist = this.getdata("playlist", id) ?? { ids: [] };
            const playlist_etag = (this_playlist?.etag && this_playlist?.etag?.length > 0) ? this_playlist?.etag : undefined;

            // check new_tracks
            let this_new_tracks = new_tracks[id] ?? { etag: "", ids: [] };
            const new_tracks_etag = this_new_tracks.etag && this_new_tracks?.etag?.length > 0 ? this_new_tracks?.etag : undefined;

            // fetch data
            const playlist_url = base_playlist__url + `&playlistId=${id}`;
            const videos = await this.fetch_data(playlist_url, false, undefined, playlist_etag);

            if (videos === null &&
                playlist_etag && new_tracks_etag &&
                playlist_etag !== new_tracks_etag
            ) {
                this_new_tracks.ids = this_playlist.ids;
                this_new_tracks.etag = playlist_etag;
            }
            else if (videos === null) {
                this_new_tracks.ids.push(...this_playlist.ids.slice(0, 6))
            }
            else {
                const TotalResult = videos.pageInfo.totalResults;
                this_new_tracks.ids.push(...videos.items.slice(0, 6).map((item: any) => { return item.snippet.resourceId.videoId }))
                const ids = Array.from(new Set([...this_playlist.ids, ...this_new_tracks.ids]));
                if (ids.length <= TotalResult) {
                    this.fetch_playlist(id);
                }
                else {
                    this_playlist.ids = ids;
                    this_playlist.etag = videos.etag;
                    this_playlist.length = TotalResult;
                    this.writedata("playlist", id, this_playlist);
                }
            }
            new_tracks[id] = this_new_tracks;
            return this_new_tracks.ids;
        }

        try {
            const new_tracks: string[] = []
            for (const id of ids) {
                try {
                    const playlistId = await artist(id);
                    const ids = await playlist(playlistId);
                    new_tracks.push(...ids);

                }
                catch (e) {
                    console.log(id);
                    console.log(e);
                }

            }

            const tracks = await this.fetch_track(new_tracks);
            return tracks;
        } catch (e) {
            throw new Error(e);
        }
    }
}