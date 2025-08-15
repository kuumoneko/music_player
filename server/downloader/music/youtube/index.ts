import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import youtubesearchapi, { SearchItem, SearchResult } from "youtube-search-api";
import { Artist, EndPoints, Music_options, Playlist, Search, Track, User_Artist, UserPlaylist, youtube_api_keys, youtube_endpoint, youtube_endpoints } from "../../../types/index.js";

export default class Youtube {
    private maxResults = 50;
    public youtube_api_key: youtube_api_keys[];
    private google_client: string | undefined;
    private google_client_secret: string | undefined;
    private port: number = 3000;
    private endpoints: youtube_endpoints = undefined as any;
    private database: string;

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
        if (isAuth) {
            const temp = this.youtube_api_key.filter((item: youtube_api_keys) => {
                return item.isAuth === true && item.reach_quota === false
            })
            return this.getRandomItem(temp).api_key
        }
        else {
            const temp = this.youtube_api_key.filter((item: youtube_api_keys) => {
                return item.isAuth === false && item.reach_quota === false
            })
            return this.getRandomItem(temp).api_key
        }
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
            if (etag !== undefined) {
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
                    console.error(data.error)
                    throw new Error("Something was wrong")
                }
            }
        }
        return data;
    }

    create_end_point(endpoint: youtube_endpoint) {
        let url = endpoint.url + "?";
        const keys = Object.keys(endpoint.params);
        for (const key of keys) {
            url += key + "=" + encodeURIComponent(endpoint.params[key]) + "&"
        }
        url = url.slice(0, -1);
        return url;
    }

    getdata(filename: string) {
        return JSON.parse(readFileSync(path.join(this.database, `${filename}.json`), { encoding: "utf-8" }));
    }

    writedata(filename: string, data: any) {
        writeFileSync(path.join(this.database, `${filename}.json`), JSON.stringify(data), { encoding: "utf-8" });
    }

    async get_me(access_token: string = ''): Promise<any> {
        const url = this.create_end_point(this.endpoints[EndPoints.User]);
        try {
            const data = await this.fetch_data(url, true, access_token);
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

    async fetch_user_playlists(access_token: string = ''): Promise<UserPlaylist> {

        let pagetoken: string = '';
        const tracks: any[] = [];
        const url = `${this.create_end_point(this.endpoints[EndPoints.UserPlaylist])}&maxResults=${this.maxResults}`;
        const user = this.getdata("user");

        try {
            let etag = (user.playlist?.etag && user.playlist?.etag?.length > 0) ? user.playlist?.etag : undefined
            while (pagetoken !== null && pagetoken !== undefined) {
                const endpoint = url + `&pageToken=${pagetoken}`;
                const video = await this.fetch_data(endpoint, true, access_token, etag);
                if (video === null) {
                    return {
                        type: "youtube:userplaylists",
                        playlists: user.playlist.list
                    }
                }
                if (pagetoken === "") {
                    etag = video.etag;
                }

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
            user.playlist = {
                etag: etag,
                list: tracks
            }
            this.writedata("user", user);
            return {
                type: "youtube:userplaylists",
                playlists: tracks
            }
        }
        catch (e) {
            throw new Error(e);
        }
    }

    async fetch_liked_tracks(access_token: string): Promise<any> {
        let pagetoken: string = '';
        const tracks: any[] = [];
        const url = `${this.create_end_point(this.endpoints[EndPoints.LikedSongs])}&maxResults=${this.maxResults}`;
        const user = this.getdata("user");

        try {
            let etag = (user.likedsongs?.etag && user.likedsongs?.etag?.length > 0) ? user.likedsongs?.etag : undefined

            while (pagetoken !== null && pagetoken !== undefined) {
                const endpoint = url + `&pageToken=${pagetoken}`;
                const video = await this.fetch_data(endpoint, true, access_token, etag);

                if (video === null) {
                    return {
                        type: "youtube:playlists",
                        thumbnail: "",
                        name: "liked songs",
                        duration: 0,
                        id: "",
                        tracks: user.likedsongs.list
                    }
                }
                if (pagetoken === "") {
                    etag = video.etag;
                }

                tracks.push(...video.items.map((item: any) => {
                    return {
                        type: "youtube:track",
                        thumbnail: item.snippet.thumbnails.default.url || "",
                        artists: [{
                            name: item.snippet.channelTitle,
                            id: item.snippet.channelId
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

            user.likedsongs = {
                etag: etag,
                list: tracks
            }
            this.writedata("user", user);

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

    async fetch_playlist_name(id: string, access_token: string = ''): Promise<string | null> {
        const url = `${this.create_end_point(this.endpoints[EndPoints.PlaylistData])}&id=${id}`
        let data = await this.fetch_data(url, (access_token !== ""), (access_token !== "") ? access_token : null)
        return data?.items[0]?.snippet?.title || null;
    }

    async fetch_playlist(id: string = '', access_token: string = '', mode: string = "normal", pagetoken: string = ''): Promise<Playlist> {
        const tracks: string[] = [];
        const url = `${this.create_end_point(this.endpoints[EndPoints.PlaylistItem])}&maxResults=${this.maxResults}&playlistId=${id}`;
        const playlist = this.getdata("playlist");
        try {
            let thumbnail: string = "";
            let this_playlist = playlist[id];
            let etag = (this_playlist?.etag && this_playlist?.etag?.length > 0) ? this_playlist?.etag : undefined;
            const temp = (this_playlist?.etag && this_playlist?.etag?.length > 0) ? this_playlist?.etag : undefined

            let done = false;
            while (!done && pagetoken !== null && pagetoken !== undefined) {
                const endpoint = url + `&pageToken=${pagetoken}`;
                let video = await this.fetch_data(endpoint, (access_token !== ""), (access_token !== "") ? access_token : null, etag);
                if (video === null && this_playlist !== undefined) {
                    return {
                        type: "youtube:playlist",
                        thumbnail: this_playlist.thumbnail,
                        name: this_playlist.name,
                        id: this_playlist.id,
                        duration: this_playlist.tracks.reduce((a: number, b: Track) => a + (b.track?.duration as number), 0),
                        tracks: this_playlist.tracks
                    }
                }
                else if (video === null) {
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
                    if (this_playlist?.tracks?.length > 0 && this_playlist?.tracks?.findIndex((track: any) => {
                        return track.track.id === item.snippet.resourceId.videoId
                    }) && temp !== undefined) {
                        done = true;
                        break;
                    }
                    tracks.push(item.snippet.resourceId.videoId)
                }
                if (mode === "normal") {
                    pagetoken = video.nextPageToken
                }
            }
            const name = await this.fetch_playlist_name(id, access_token)
            const res = await this.fetch_track(tracks)
            playlist[id] = {
                etag: etag,
                thumbnail: thumbnail,
                name: name as string,
                id: id,
                tracks: (temp === undefined) ? res : Array.from(new Set([...this_playlist?.tracks || [], ...res]))
            }
            this.writedata("playlist", playlist)

            return {
                type: "youtube:playlist",
                thumbnail: thumbnail,
                name: name as string,
                duration: res.reduce((a: number, b: Track) => a + (b.track?.duration as number), 0),
                id: id,
                tracks: res
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
            const tracks: Track[] = this.getdata("track");
            const tracks_in_database = tracks.filter((item: Track) => {
                return (ids.findIndex((id: string) => {
                    return item.track?.id === id;
                }) !== -1)
            })

            const tracks_out_database = ids.filter((id: string) => {
                return tracks.findIndex((track: Track) => {
                    return track.track?.id === id
                }) === -1
            })

            if (tracks_out_database.length > 0) {
                let st = 0, ed = 49;
                if (ed > tracks_out_database.length - 1) {
                    ed = tracks_out_database.length - 1;
                }

                const url = `${this.create_end_point(this.endpoints[EndPoints.Videos])}`;
                const dataa: any[] = []

                while (st <= tracks_out_database.length - 1) {
                    const endpoint = url + `&id=${tracks_out_database.slice(st, ed + 1).join("%2C")}`
                    const data: any = await this.fetch_data(endpoint, false);
                    for (const item of data.items) {

                        dataa.push({
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
                                duration: this.iso8601DurationToMilliseconds(item.contentDetails.duration), // in miliseconds
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
                tracks.push(...dataa);
                tracks_in_database.push(...dataa);
            }

            const temp = tracks;
            temp.push(...tracks_in_database);
            const temping = Array.from(new Set(temp));

            this.writedata("track", temping)
            return tracks_in_database;
        }
        catch (e) {
            throw new Error(e);
        }
    }

    async search(search: string = ''): Promise<Search> {

        try {
            let data: SearchResult = await youtubesearchapi.GetListByKeyword(search, false, 30, [{ type: 'video' }])


            const ids: string[] = data.items.map((item: SearchItem) => { return item.id });
            const tracks = await this.fetch_track(ids);

            return {
                type: "youtube:search",
                tracks: tracks
            }
        }
        catch (e) {
            throw new Error(e);
        }
    }

    async fetch_following_artists(access_token: string = ''): Promise<User_Artist> {
        let pageToken: string = "";
        const artists: Artist[] = [];
        const url = `${this.create_end_point(this.endpoints[EndPoints.UserArtist])}&maxResults=${this.maxResults}`;
        const user = this.getdata("user");
        try {
            let etag = (user.artist?.etag && user.artist?.etag?.length > 0) ? user.artist?.etag : undefined

            while (pageToken !== null && pageToken !== undefined) {
                const endpoint = url + `&pageToken=${pageToken}`
                const data = await this.fetch_data(endpoint, (access_token !== ""), (access_token !== "") ? access_token : null, etag);

                if (data === null) {
                    return {
                        type: "youtube:artists",
                        artists: user.artist.list
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
            user.artist = {
                etag: etag,
                list: artists
            }
            this.writedata("user", user);
            return {
                type: "youtube:artists",
                artists: artists
            };
        }
        catch (e) {
            throw new Error(e);
        }

    }

    async fetch_artist(id: string, pagetoken: string = ''): Promise<Artist> {
        const data = this.getdata("artist");
        try {
            const this_artist = data[id];
            let etag = (this_artist?.etag && this_artist.etag?.length > 0) ? this_artist?.etag : undefined
            const url = `${this.create_end_point(this.endpoints[EndPoints.Artist])}&id=${id}`;
            const item = (await this.fetch_data(url, false, undefined, etag) as any);
            if (item === null) {
                let playlist_id = this_artist.playlistId || "";
                if (playlist_id === "") {
                    const temping = (await this.fetch_data(url, false, undefined) as any);
                    playlist_id = temping.items[0].contentDetails.relatedPlaylists.uploads
                }
                const artist_tracks = (await this.fetch_playlist(playlist_id, undefined, "artist", pagetoken)).tracks as Track[];
                data[id].tracks = artist_tracks;
                this.writedata("artist", data);
                return {
                    type: "youtube:artist",
                    name: this_artist.name,
                    id: this_artist.id,
                    tracks: artist_tracks,
                    thumbnail: this_artist.thumbnail
                }
            }
            etag = item.etag;
            const itemm = item.items[0];
            let playlist_id = itemm.contentDetails.relatedPlaylists.uploads;
            const artist_tracks = (await this.fetch_playlist(playlist_id, undefined, "artist", pagetoken)).tracks as Track[];
            data[id] = {
                etag: etag,
                name: itemm.snippet.title,
                id: itemm.id,
                tracks: artist_tracks,
                thumbnail: itemm.snippet?.thumbnails?.default?.url || "",
                videoCount: itemm.statistics.videoCount,
                playlistId: playlist_id
            }
            this.writedata("artist", data);
            return {
                type: "youtube:artist",
                name: itemm.snippet.title,
                id: itemm.id,
                tracks: artist_tracks,
                thumbnail: itemm.snippet?.thumbnails?.default?.url || ""
            }
        }
        catch (e) {
            throw new Error(e);
        }
    }

    async get_new_tracks(ids: string[]) {
        try {
            const artists = this.getdata("artist");
            const playlists = this.getdata("playlist");
            const new_tracks = this.getdata("new_tracks")
            const base_playlist__url = `${this.create_end_point(this.endpoints[EndPoints.PlaylistItem])}&maxResults=${this.maxResults}`;
            const base_artist__url = `${this.create_end_point(this.endpoints[EndPoints.Artist])}`;

            const tracks: Track[] = [];

            for (const id of ids) {
                const artist_url = base_artist__url + `&id=${id}`;
                const this_artist = artists[id];

                const artist_etag = (this_artist?.etag && this_artist?.etag?.length > 0) ? this_artist?.etag : undefined;

                const artist = await this.fetch_data(artist_url, false, null, artist_etag);

                let playlistId = "";
                let thumbnail = "", name = "";

                if (artist === null) {
                    if (this_artist.playlistId && this_artist.playlistId?.length > 0) {
                        playlistId = this_artist.playlistId;
                        thumbnail = this_artist.thumbnail;
                        name = this_artist.name
                    }
                    else {
                        const temp_artist = await this.fetch_data(artist_url, false, null);
                        playlistId = temp_artist.items[0].contentDetails.relatedPlaylists.uploads;
                        thumbnail = temp_artist.items[0].snippet.thumbnails.default.url;
                        name = temp_artist.items[0].snippet.title;
                        artists[id] = {
                            ...this_artist,
                            playlistId: playlistId
                        }
                    }
                }
                else {
                    const itemm = artist.items[0]
                    playlistId = itemm.contentDetails.relatedPlaylists.uploads;
                    thumbnail = itemm.snippet.thumbnails.default.url;
                    name = itemm.snippet.title;
                    artists[id] = {
                        etag: artist.etag,
                        name: itemm.snippet.title,
                        id: itemm.id,
                        tracks: [],
                        thumbnail: itemm.snippet?.thumbnails?.default?.url || "",
                        videoCount: itemm.statistics.videoCount,
                        playlistId: playlistId
                    }
                }

                const playlist_url = base_playlist__url + `&playlistId=${playlistId}`;

                const this_playlist = playlists[playlistId];
                const playlist_etag = (this_playlist?.etag && this_playlist?.etag?.length > 0) ? this_playlist?.etag : undefined;

                const this_new_tracks = new_tracks[id] || {
                    etag: undefined,
                    tracks: []
                };
                const new_tracks_etag = (this_new_tracks?.etag && this_new_tracks?.etag?.length > 0) ? this_new_tracks?.etag : undefined;

                let video = await this.fetch_data(playlist_url, false, null, playlist_etag);

                // if etag of this not similar, and playlist has nothing changed, update playlist into new list, create for it a expires time to show, i think it will be a day from now
                if (video === null && playlist_etag !== new_tracks_etag) {
                    const updated_items: any[] = [];

                    if (this_new_tracks?.tracks?.length === 0 || this_new_tracks?.tracks === null) {
                        updated_items.push(...this_playlist.tracks.slice(0, 6))
                    }
                    else {
                        for (const item of this_playlist.tracks) {
                            if (this_new_tracks?.tracks?.includes(item)) break;
                            updated_items.push(item);
                        }
                    }
                    new_tracks[id] = {
                        etag: playlist_etag,
                        tracks: updated_items,
                        expires: new Date().getTime() + 24 * 60 * 60 * 1000 // add one day into now
                    }
                    artists[id].tracks = this_playlist.tracks
                    tracks.push(...updated_items.slice(0, 6))
                }
                else if (video !== null) {
                    const etag = video.etag
                    const playlist_ids: string[] = [];
                    let done = false;

                    while (!done) {
                        let is_done = false;
                        if (this_new_tracks.tracks?.length === 0 || this_new_tracks.tracks === null) {
                            playlist_ids.push(...video.items.slice(0, 6).map((track: any) => { return track.snippet.resourceId.videoId }))
                            done = true;
                        }
                        else {
                            for (const item of video.items as Track[]) {
                                if (this_new_tracks?.tracks?.findIndex((new_track: Track) => { return new_track.track?.id === item.track?.id }) !== -1) {
                                    is_done = true;
                                    break;
                                }
                                playlist_ids.push(item.track?.id || "");
                            }
                            if (is_done) {
                                done = true;
                            }
                            else {
                                let pagetoken = video.nextPageToken || undefined
                                if (pagetoken === undefined) {
                                    done = true;
                                }
                                else {
                                    video = await this.fetch_data(playlist_url + `&pageToken=${pagetoken}`, false, null, playlist_etag);
                                }
                            }
                        }
                    }

                    const nnew_tracks = await this.fetch_track(playlist_ids);
                    const data_tracks = [... new Set([...this_playlist?.tracks || [], ...nnew_tracks])];
                    tracks.push(...nnew_tracks.slice(0, 6));
                    playlists[playlistId] = {
                        etag: etag,
                        thumbnail: thumbnail,
                        name: name as string,
                        id: id,
                        tracks: data_tracks
                    }
                    new_tracks[id] = {
                        etag: playlist_etag,
                        tracks: nnew_tracks,
                        expires: new Date().getTime() + 24 * 60 * 60 * 1000 // add one day into now
                    }
                    artists[id].tracks = data_tracks;
                }
                else {
                    const expired = this_new_tracks.expires as number;
                    const now = new Date().getTime();
                    if (now < expired) {
                        tracks.push(...this_new_tracks.tracks.slice(0, 6));
                    }
                }
            }
            this.writedata("artist", artists);
            this.writedata("new_tracks", new_tracks);
            this.writedata("playlist", playlists);
            return tracks;
        }
        catch (e) {
            throw new Error(e);
        }
    }
}