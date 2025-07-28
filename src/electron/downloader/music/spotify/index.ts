/* eslint-disable no-loop-func */
import axios from "axios";
import { Album, Mode, Music_options, Playlist, Search, Track, User } from "../../../types/index.ts";
import { Buffer } from "node:buffer"

export default class Spotify {
    private spotify_api_key: string | undefined;
    private spotify_client_id: string | undefined;
    private token: string | undefined = "";
    private access_token: string | undefined = "";
    private mode: Mode;
    private port: number = 3000;


    constructor(options: Music_options, mode: Mode) {
        // client API
        this.spotify_api_key = options.spotify_api_key;
        this.spotify_client_id = options.spotify_client;
        this.mode = mode;
        this.port = options.port || 3000;
    }

    set_access_token(token: string) {
        this.access_token = token;
    }

    get_access_token() {
        return this.access_token;
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
            // console.log(data)
            this.token = data.access_token;
        }
    }

    async getme(token: string) {
        const userResponse = await axios.get('https://api.spotify.com/v1/me', {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        const spotifyUser = userResponse.data;
        return spotifyUser
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
                // console.log(response.data)
                const { access_token, refresh_token } = response.data;
                // const userResponse = await axios.get('https://api.spotify.com/v1/me', {
                //     headers: {
                //         'Authorization': `Bearer ${access_token}`,
                //     },
                // });
                const spotifyUser = await this.getme(access_token);
                resolve({
                    user: spotifyUser,
                    refresh_token: refresh_token,
                    access_token: access_token,
                    expires: new Date().getTime() + (response.data.expires_in * 1000)
                });
            } catch (error) {
                console.error("Error verifying Spotify ID token:", error);
                reject(null);
            }
        })
    }

    refreshSpotifyToken(token: string) {
        return new Promise(async (resolve, reject) => {
            try {
                // const clientId = this.spotify_client_id; // Replace with your client ID
                // const clientSecret = this.spotify_api_key; // Replace with your client secret
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
            } catch (error) {
                console.error("Error refresh Spotify ID token:", error);
                resolve(null);
            }
        })
    }


    async fetch_spotify_user(id: string = ''): Promise<User> {
        await this.get_token();
        const url = `https://api.spotify.com/v1/users/${id}`
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${this.token}` },
        });
        const data = await response.json();
        return {
            type: "spotify:user",
            name: data.display_name,
            thumbnail: data.images[0]?.url || "",
        };
    }

    async fetch_spotify_user_playlists(id: string = '', access_token: string): Promise<any> {
        await this.get_token();
        const url = `https://api.spotify.com/v1/users/${id}/playlists`
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${access_token}` },
        });
        let video = await response.json();

        let tracks: any[] = video.items.map((item: any) => {
            return {
                playlistName: item.name,
                playlistId: item.id,
                authorName: item.owner.display_name,
                thumbnail: item.images[0].url || null
            }
        });

        while (video.next) {
            const url = video?.next || video.tracks?.next;
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
                    playlistName: item.name,
                    playlistId: item.id,
                    authorName: item.owner.display_name,
                    thumbnail: item.images[0].url || null
                }
            }))
        }


        return {
            type: "spotify:userplaylists",
            // thumbnail: thumbnail,
            playlists: tracks
        }

    }


    async fetch_spotify_user_saved_playlists(access_token: string = ''): Promise<Playlist> {
        await this.get_token();
        const url = ` https://api.spotify.com/v1/me/tracks`
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${access_token !== '' ? access_token : this.token}` },
        });
        let video = await response.json();
        let duration: number = 0;

        console.log(video)

        let tracks: Track[] = video.items
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
            });


        while (video.tracks?.next || video.next) {
            const url = video.tracks?.next || video.next;
            const response = await fetch(url, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${access_token !== '' ? access_token : this.token}` },
            });
            video = await response.json();

            console.log(video)

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
                    }
                }))
        };

        return {
            type: "spotify:playlists",
            thumbnail: "",
            name: "liked songs",
            duration: duration,
            id: "",
            tracks: tracks
        }
    }

    async search_spotify_video(search: string = ''): Promise<Search> {
        await this.get_token();
        const url = `https://api.spotify.com/v1/search?q=${search}&type=track&limit=25`
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${this.token}` },
        });
        const data = await response.json();
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


    async fetchPlaylistVideos_spotify(link: string = '', token?: string): Promise<Playlist> {
        await this.get_token();

        const url = (link.includes("spot")) ? link : `https://api.spotify.com/v1/playlists/${link}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token ? token : this.token}` },
        });
        let video = await response.json();

        if (video.error?.status === 404 || video.error?.status === 400 || video.error?.status === 401) {
            return {
                error: video.message,
                type: "spotify:error",
                tracks: [],
                name: "",
                duration: 0,
                id: "",
                thumbnail: ""
            }
        }
        else {

            let duration: number = 0;
            let tracks: Track[] = video.tracks.items
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
                });
            const thumbnail = video.images[video.images.length - 1].url,
                name = video.name,
                id = video.id;

            while (video.tracks?.next || video.next) {
                const temp = video.tracks?.next || video.next

                const url = (temp.includes("spot")) ? temp : `https://api.spotify.com/v1/playlists/${temp}`;
                const response = await fetch(url, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${token ? token : this.token}` },
                });
                video = await response.json();

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
                        }
                    }))
            };

            return {
                type: "spotify:playlist",
                name: name,
                duration: duration,
                id: id,
                thumbnail: thumbnail,
                tracks: tracks
            }
        }

    }

    async fetchTrackVideos_spotify(id: string = ''): Promise<Track> {
        await this.get_token();
        const url = `https://api.spotify.com/v1/tracks/${id}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${this.token}` },
        });
        const video = await response.json();
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

    async fetchAlbumVideos_spotify(id: string = ''): Promise<Album> {
        await this.get_token();
        const url = `https://api.spotify.com/v1/albums/${id}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${this.token}` },
        });
        const video = await response.json();
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

}