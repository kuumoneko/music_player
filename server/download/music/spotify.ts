/* eslint-disable no-loop-func */
import { Buffer } from "node:buffer"
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { Album, Artist, Music_options, Playlist, Search, Track, User_Artist, UserPlaylist } from "../../types/index.js";

export default class Spotify {
    private spotify_api_key: string | undefined;
    private spotify_client_id: string | undefined;
    private token: string | undefined = "";
    private port: number = 3000;
    private database: string;

    constructor(options: Music_options) {
        this.spotify_api_key = options.spotify_api_key;
        this.spotify_client_id = options.spotify_client;
        this.port = options.port || 3000;
        this.database = options.database;
    }

    getdata(filename: string) {
        try {
            const temp = JSON.parse(readFileSync(path.join(this.database, `${filename}.json`), { encoding: "utf-8" }));
            return temp;
        }
        catch {
            return undefined
        }
    }

    writedata(filename: string, data: any) {
        writeFileSync(path.join(this.database, `${filename}.json`), JSON.stringify(data), { encoding: "utf-8" });
    }

    sleep(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async fetch_data(
        url: string,
        access_token?: string) {
        try {
            const max_retry = 10;
            let time = 0;
            await this.get_token();

            let done = false;
            while (!done) {
                if (time >= max_retry) {
                    done = true;
                    throw new Error("Cant fetch dataa from Spotify, reach max retry")
                }
                const response = await fetch(`${url}`, {
                    method: "GET",
                    headers: {
                        'Authorization': `Bearer ${(access_token && access_token !== "") ? access_token : this.token}`,
                        'Content-Type': 'application/json',
                    }
                })

                if (response.status === 429) {
                    const retryAfter = response.headers.get('Retry-After');
                    console.log(`Rate limit hit. Retry after ${retryAfter} seconds.`);
                    time += 1;
                    await this.sleep(Number(retryAfter) * 1000);
                } else {
                    const data = await response.json();
                    done = true;
                    return data;
                }
            }
        }
        catch (e) {
            throw new Error(e);
        }
    }

    async get_token() {
        if (this.token === "") {
            var client_id = this.spotify_client_id;
            var client_secret = this.spotify_api_key;
            const response = await fetch('https://accounts.spotify.com/api/token', {
                method: 'POST',
                body: new URLSearchParams({
                    'grant_type': 'client_credentials',
                }),
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': 'Basic ' + (Buffer.from(client_id + ':' + client_secret).toString('base64')),
                },
            });
            const data = await response.json();
            this.token = data.access_token;
        }
    }

    verifySpotifyToken(token: string) {
        return new Promise(async (resolve, reject) => {
            try {
                const clientId = this.spotify_client_id; // Replace with your client ID
                const clientSecret = this.spotify_api_key; // Replace with your client secret

                const response = await fetch('https://accounts.spotify.com/api/token', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Basic ${Buffer.from(clientId + ':' + clientSecret).toString('base64')}`,
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: new URLSearchParams({
                        grant_type: 'authorization_code',
                        code: token,
                        redirect_uri: `http://localhost:${this.port}`,
                    }),
                });
                const { access_token, refresh_token, expires_in } = await response.json();
                const spotifyUser = await this.get_me(access_token);
                resolve({
                    user: spotifyUser,
                    refresh_token: refresh_token,
                    access_token: access_token,
                    expires: new Date().getTime() + (expires_in * 1000)
                });
            } catch (e) {
                throw new Error(e);
            }
        })
    }

    refreshSpotifyToken(token: string) {
        return new Promise(async (resolve, reject) => {
            try {
                const url = "https://accounts.spotify.com/api/token";

                const payload = {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: new URLSearchParams({
                        grant_type: 'refresh_token',
                        refresh_token: token,
                        client_id: this.spotify_client_id as string,
                        client_secret: this.spotify_api_key as string,
                    }),
                }
                const body = await fetch(url, payload);
                const response = await body.json();
                resolve({
                    access_token: response.access_token,
                    expires: new Date().getTime() + response.expires_in * 1000,
                    refresh_token: response.refresh_token || undefined,
                });
            } catch (e) {
                throw new Error(e);
            }
        })
    }

    async get_me(token: string) {
        const data = await this.fetch_data('https://api.spotify.com/v1/me', token)
        return {
            name: data.display_name,
            email: data.email,
            id: data.id
        }
    }

    async fetch_user_playlists(access_token: string): Promise<UserPlaylist> {
        const { id } = await this.get_me(access_token);
        let url: string = `https://api.spotify.com/v1/users/${id}/playlists`
        const tracks: any[] = [];
        try {
            while (url !== null && url !== undefined) {
                const video = await this.fetch_data(url, access_token);
                tracks.push(...video.items.map((item: any) => {
                    return {
                        type: "spotify:userplaylist",
                        playlistName: item.name,
                        playlistId: item.id,
                        authorName: item.owner.display_name,
                        thumbnail: item.images[0].url || null
                    }
                }))
                url = video.next;
            }
            return {
                type: "spotify:userplaylists",
                playlists: tracks
            }
        }
        catch (e) {
            throw new Error(e);
        }
    }

    async fetch_liked_tracks(access_token: string = ''): Promise<Playlist> {
        let url = ` https://api.spotify.com/v1/me/tracks`
        const tracks: Track[] = [];
        try {
            let duration: number = 0;
            while (url !== null && url !== undefined) {
                const video = await this.fetch_data(url, access_token);
                tracks.push(...video.items
                    .filter((item: any) => item.track !== null)
                    .map((item: any) => {
                        duration += item.track.duration_ms;
                        return {
                            type: "spotify:track",
                            thumbnail: item.track.album.images[item.track.album.images.length - 1]?.url || null,
                            artists: item.track.artists.map((artist: any) => {
                                return {
                                    name: artist.name,
                                    id: artist.id

                                }
                            }),
                            track: {
                                name: item.track.name,
                                id: item.track.id,
                                duration: item.track.duration_ms, // in miliseconds
                                releaseDate: item.track.album.release_date,
                            }
                        } as Track
                    }))
                url = video.next;
            }
            for (const item of tracks) {
                const { thumbnail, track, artists } = item;
                const { id, name, duration, releaseDate } = track ?? {};
                if (!existsSync(path.join(this.database, `${id}.json`)) && id) {
                    this.writedata(id as string, {
                        name: name,
                        duration: duration,
                        releaseDate: releaseDate,
                        thumbnail: thumbnail,
                        artists: artists,
                        matched: null,
                        music_url: null
                    })
                }
            }
            return {
                type: "spotify:playlists",
                thumbnail: "",
                name: "liked songs",
                duration: duration,
                id: "",
                tracks: tracks
            }
        }
        catch (e) {
            throw new Error(e);
        }
    }

    async search(search: string = ''): Promise<Search> {
        const url = `https://api.spotify.com/v1/search?q=${search}&type=track&limit=25`

        try {
            const data = await this.fetch_data(url);
            return {
                type: "spotify:search",
                tracks: data.tracks.items.map((item: any) => {
                    return {
                        type: "spotify:track",
                        thumbnail: item.album.images[item.album.images.length - 1]?.url || null,
                        artists: item.artists.map((artist: any) => {
                            return {
                                name: artist.name,
                                id: artist.id
                            }
                        }),
                        track: {
                            name: item.name,
                            id: item.id,
                            duration: item.duration_ms, // in miliseconds
                            releaseDate: item.album.release_date,
                        }
                    }
                })
            }
        }
        catch (e) {
            throw new Error(e);
        }

    }

    async fetch_playlist(id: string = '', token?: string): Promise<Playlist> {
        let url: string = `https://api.spotify.com/v1/playlists/${id}`,
            thumbnail = "", name = "", duration = 0
        const tracks: any[] = [];

        try {
            while (url !== null && url !== undefined) {
                const video = await this.fetch_data(url, token);

                if (thumbnail === "" && name === "") {
                    thumbnail = video.images[video.images.length - 1].url;
                    name = video.name;
                    id = video.id;
                }
                const temp = (url.includes("/tracks?")) ? video.items : video.tracks.items
                tracks.push(...temp
                    .filter((item: any) => item.track !== null)
                    .map((item: any) => {
                        duration += item.track.duration_ms;
                        return {
                            type: "spotify:track",
                            thumbnail: item.track.album.images[item.track.album.images.length - 1]?.url || null,
                            artists: item.track.artists.map((artist: any) => {
                                return {
                                    name: artist.name,
                                    id: artist.id
                                }
                            }),
                            track: {
                                name: item.track.name,
                                id: item.track.id,
                                duration: item.track.duration_ms,
                                releaseDate: item.track.album.release_date,
                            }
                        }
                    }))
                url = video?.tracks?.next || undefined;
            }

            for (const item of tracks) {
                const { thumbnail, track, artists } = item;
                const { id, name, duration, releaseDate } = track ?? {};

                if (!existsSync(path.join(this.database, `${id}.json`)) && id) {
                    this.writedata(id as string, {
                        name: name,
                        duration: duration,
                        releaseDate: releaseDate,
                        thumbnail: thumbnail,
                        artists: artists,
                        matched: null,
                        music_url: null
                    })
                }
            }

            return {
                type: "spotify:playlist",
                name: name,
                duration: duration,
                id: id,
                thumbnail: thumbnail,
                tracks: tracks
            }
        }
        catch (e) {
            throw new Error(e);
        }
    }

    async fetch_track(id: string = ''): Promise<Track> {
        const url = `https://api.spotify.com/v1/tracks/${id}`;
        try {
            let data = this.getdata(id) ?? undefined;
            if (data) {
                const video = data
                return {
                    type: "spotify:track",
                    thumbnail: video.thumbnail,
                    artists: video.artists,
                    track: {
                        name: data.name,
                        id: id,
                        duration: data.duration,
                        releaseDate: data.releaseDate
                    }
                }
            }
            const video = await this.fetch_data(url);
            data = {
                type: "spotify:track",
                thumbnail: video.album.images[video.album.images.length - 1]?.url || null,
                artists: video.artists.map((artist: any) => {
                    return {
                        name: artist.name,
                        id: artist.id
                    }
                }),
                track: {
                    name: video.name,
                    id: video.id,
                    duration: video.duration_ms, // in miliseconds
                    releaseDate: video.album.release_date,
                }
            }
            this.writedata(id, {
                name: data.track.name,
                duration: data.track.duration,
                releaseDate: data.track.releaseDate,
                thumbnail: data.thumbnail,
                artists: data.artists,
                matched: data.matched ?? null,
                music_url: data.music_url ?? null
            });
            return data
        }
        catch (e) {
            throw new Error(e);
        }
    }

    async fetch_album(id: string = ''): Promise<Album> {
        const url = `https://api.spotify.com/v1/albums/${id}`;

        try {
            const video = await this.fetch_data(url);
            return {
                type: "spotify:album",
                name: video.name,
                id: video.id,
                duration: video.tracks.items.map((item: any) => item.duration_ms).reduce((a: number, b: number) => a + b, 0),
                releaseDate: video.release_date,
                artists: video.artists.map((artist: any) => {
                    return {
                        name: artist.name,
                        id: artist.id
                    }
                }),
                thumbnail: video.images[video.images.length - 1].url,
                tracks: video.tracks.items.map((item: any) => {
                    return {
                        type: "spotify:track",
                        artists: video.artists.map((artist: any) => {
                            return {
                                name: artist.name,
                                id: artist.id
                            }
                        }),
                        thumbnail: video.images[video.images.length - 1].url,
                        track: {
                            name: item.name,
                            id: item.id,
                            duration: item.duration_ms, // in miliseconds
                            releaseDate: video.release_date,
                        }
                    } as Track
                })
            };
        }
        catch (e) {
            throw new Error(e);
        }
    }

    async fetch_following_artists(access_token: string = ''): Promise<User_Artist> {
        let url = `https://api.spotify.com/v1/me/following?type=artist&limit=50`;
        const artists: Artist[] = [];

        try {
            while (url !== null && url !== undefined) {
                const data = await this.fetch_data(url, access_token);
                artists.push(...data.artists.items
                    .filter((item: any) => item.track !== null)
                    .map((item: any) => {
                        return {
                            type: "spotify:artist",
                            thumbnail: item.images[item.images.length - 1]?.url || null,
                            name: item.name,
                            id: item.id
                        }
                    }))
                url = data.next
            }

            return {
                type: "spotify:artist",
                artists: artists
            }
        }
        catch (e) {
            throw new Error(e);
        }
    }

    async fetch_artist(id: string): Promise<Artist> {
        let url = `https://api.spotify.com/v1/artists/${id}/albums?include_groups=single&limit=50`;
        const tracks: Track[] = [];
        try {
            while (url !== null && url !== undefined) {
                const data = await this.fetch_data(url);
                tracks.push(...data.items.map((item: any) => {
                    return {
                        type: "spotify:track",
                        thumbnail: item.images[item.images.length - 1].url || "",
                        artists: item.artists.map((artist: any) => {
                            return {
                                name: artist.name,
                                id: artist.name
                            }
                        }),
                        track: {
                            name: item.name,
                            id: item.id,
                            releaseDate: item.release_date,
                        }
                    }
                }))
                url = data.next
            }
            const data = await this.fetch_data(`https://api.spotify.com/v1/artists/${id}`)
            return {
                type: "spotify:artist",
                name: data.name,
                id: data.id,
                thumbnail: data.images[data.images.length - 1].url,
                tracks: tracks
            };
        }
        catch (e) {
            throw new Error(e)
        }
    }

    async get_new_tracks(ids: string[]) {
        try {
            const number_of_tracks_to_get = 5;
            const tracks: Track[] = [];
            for (const id of ids) {
                const artist = await this.fetch_artist(id);
                tracks.push(...(artist.tracks as Track[]).slice(0, number_of_tracks_to_get + 1));
            }
            return tracks;
        }
        catch (e) {
            throw new Error(e);
        }
    }
}