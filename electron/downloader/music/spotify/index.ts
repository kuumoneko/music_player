/* eslint-disable no-loop-func */
import axios from "axios";
import { Album, Artist, Music_options, Playlist, Search, Track, User, User_Artist, UserPlaylist } from "../../../types/index.js";
import { Buffer } from "node:buffer"

export default class Spotify {
    private spotify_api_key: string | undefined;
    private spotify_client_id: string | undefined;
    private token: string | undefined = "";
    private access_token: string | undefined = "";
    private port: number = 3000;

    constructor(options: Music_options) {
        this.spotify_api_key = options.spotify_api_key;
        this.spotify_client_id = options.spotify_client;
        this.port = options.port || 3000;
    }

    set_access_token(token: string) {
        this.access_token = token;
    }

    get_access_token() {
        return this.access_token;
    }

    async fetch_data(
        url: string,
        access_token?: string) {
        try {
            await this.get_token();

            const response = await fetch(`${url}`, {
                method: "GET",
                headers: {
                    'Authorization': `Bearer ${(access_token && access_token !== "") ? access_token : this.token}`,
                    'Content-Type': 'application/json',
                }
            })
            const data = await response.json();

            return data;
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
                const response = await axios.post('https://accounts.spotify.com/api/token',
                    new URLSearchParams({
                        grant_type: 'authorization_code',
                        code: token,
                        redirect_uri: `http://localhost:${this.port}`,
                    }),
                    {
                        headers: {
                            'Authorization': `Basic ${(Buffer.from(clientId + ':' + clientSecret).toString('base64'))}`,
                            'Content-Type': 'application/x-www-form-urlencoded',
                        },
                    }
                );
                const { access_token, refresh_token } = response.data;
                const spotifyUser = await this.getme(access_token);
                resolve({
                    user: spotifyUser,
                    refresh_token: refresh_token,
                    access_token: access_token,
                    expires: new Date().getTime() + (response.data.expires_in * 1000)
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

    async getme(token: string) {
        return await this.fetch_data('https://api.spotify.com/v1/me', token)
    }

    async fetch_spotify_user(id: string = ''): Promise<User> {
        const url = `https://api.spotify.com/v1/users/${id}`
        const data = await this.fetch_data(url)
        return {
            type: "spotify:user",
            name: data.display_name,
            thumbnail: data.images[0]?.url || "",
        };
    }

    async fetch_spotify_user_playlists(id: string = '', access_token: string): Promise<UserPlaylist> {
        let url: string = `https://api.spotify.com/v1/users/${id}/playlists`
        const tracks: any[] = [];
        try {
            while (url !== null && url !== undefined) {
                const video = await this.fetch_data(url, access_token);
                tracks.push(...video.items.map((item: any) => {
                    return {
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

    async fetch_spotify_user_saved_playlists(access_token: string = ''): Promise<Playlist> {
        let url = ` https://api.spotify.com/v1/me/tracks`
        const tracks: any[] = [];
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
                                    name: artist.name
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

    async search_spotify_video(search: string = ''): Promise<Search> {
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
                                name: artist.name
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

    async fetchPlaylistVideos_spotify(link: string = '', token?: string): Promise<Playlist> {
        let url: string = `https://api.spotify.com/v1/playlists/${link}`,
            thumbnail = "", name = "", id = "", duration = 0
        const tracks: any[] = [];

        try {
            while (url !== null && url !== undefined) {
                const video = await this.fetch_data(url, token);
                if (thumbnail === "" && name === "" && id === "") {
                    thumbnail = video.images[video.images.length - 1].url;
                    name = video.name;
                    id = video.id;
                }
                tracks.push(...video.tracks.items
                    .filter((item: any) => item.track !== null)
                    .map((item: any) => {
                        duration += item.track.duration_ms;
                        return {
                            type: "spotify:track",
                            thumbnail: item.track.album.images[item.track.album.images.length - 1]?.url || null,
                            artists: item.track.artists.map((artist: any) => {
                                return {
                                    name: artist.name
                                }
                            }),
                            track: {
                                name: item.track.name,
                                id: item.track.id,
                                duration: item.track.duration_ms, // in miliseconds
                                releaseDate: item.track.album.release_date,
                            }
                        }
                    }))
                url = video.next;
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

    async fetchTrackVideos_spotify(id: string = ''): Promise<Track> {
        const url = `https://api.spotify.com/v1/tracks/${id}`;
        try {
            const video = await this.fetch_data(url);
            return {
                type: "spotify:track",
                thumbnail: video.album.images[video.album.images.length - 1]?.url || null,
                artists: video.artists.map((artist: any) => {
                    return {
                        name: artist.name
                    }
                }),
                track: {
                    name: video.name,
                    id: video.id,
                    duration: video.duration_ms, // in miliseconds
                    releaseDate: video.album.release_date,
                }
            };
        }
        catch (e) {
            throw new Error(e);
        }
    }

    async fetchAlbumVideos_spotify(id: string = ''): Promise<Album> {
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
                        name: artist.name
                    }
                }),
                thumbnail: video.images[video.images.length - 1].url,
                tracks: video.tracks.items.map((item: any) => {
                    return {
                        type: "spotify:track",
                        artists: video.artists.map((artist: any) => {
                            return {
                                name: artist.name
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

    async fetch_user_following_artists(access_token: string = ''): Promise<User_Artist> {
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

    async fetch_artists(id: string): Promise<Artist> {
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
                                name: artist.name
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
}