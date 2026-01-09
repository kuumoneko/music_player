import { Buffer } from "node:buffer"
import { Album, Artist, Playlist, Search, spotify_api_keys, Track } from "../types/index.ts";
import { getDataFromDatabase, writeDataToDatabase } from "../lib/database.ts";

interface Spotify_Key { key: string, client_id: string, token: string, isReached: boolean, when: number }
export default class Spotify {
    private spotify_api_keys: Spotify_Key[] = [];
    private path: string = "";
    private tracks: Object = {};
    private playlists: Object = {};

    constructor(options: { spotify_api_keys: spotify_api_keys[], path: string }) {
        this.spotify_api_keys = options.spotify_api_keys.map((item: spotify_api_keys) => {
            return {
                isReached: item.isReached,
                when: item.RetryAfter,
                key: item.ApiKey ?? "",
                client_id: item.ClientId ?? "",
                token: ""
            }
        });
        this.path = options.path;
        this.tracks = getDataFromDatabase(this.path, "tracks");
        this.playlists = getDataFromDatabase(this.path, "playlists");
    }

    getdata(doc: "tracks" | "playlists", ids: string[]): Track[] | Playlist[] {
        try {
            const res = ids.map((id: string) => {
                return this[doc][id] ?? { id, name: undefined };
            })
            return res as Track[];
        }
        catch {
            return [] as unknown as Track[]
        }
    }

    writedata(doc: "tracks" | "playlists", ids: string[], data: any) {
        try {
            const dataMap = new Map(data.map((item: any) => [item.id, item]));
            ids.forEach((id: string) => {
                const item = dataMap.get(id);
                this[doc][id] = item ?? { id, name: undefined };
            });
            writeDataToDatabase(this.path, doc, this[doc]);
            return "ok"
        }
        catch {
            return undefined
        }
    }

    sleep(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    getRandomItem(list: any[]): Spotify_Key {
        const randomIndex = Math.floor(Math.random() * list.length);
        return list[randomIndex];
    }

    async chose_api_key() {
        const temp = this.spotify_api_keys.filter((item: Spotify_Key) => {
            return item.isReached === false
        })
        const res = this.getRandomItem(temp);

        await this.get_token(res);
        return res.token
    }

    async fetch_data(
        url: string,
        access_token?: string) {
        try {
            const max_retry = 10;
            let time = 0;
            let token = await this.chose_api_key();
            let done = false;
            while (!done) {
                if (time >= max_retry) {
                    done = true;
                    throw new Error("Cant fetch dataa from Spotify, reach max retry")
                }
                const response = await fetch(`${url}`, {
                    method: "GET",
                    headers: {
                        'Authorization': `Bearer ${(access_token && access_token !== "") ? access_token : token}`,
                        'Content-Type': 'application/json',
                    }
                })

                if (response.status === 429) {
                    const retryAfter = response.headers.get('Retry-After');
                    if (Number(retryAfter) > 1000) {
                        done = true;
                        return null
                    }
                    console.log(`Rate limit hit. Retry after ${retryAfter} seconds.`);
                    time += 1;

                    const temp = this.spotify_api_keys.filter((item: Spotify_Key) => {
                        return item.token === token
                    });
                    const lmao = temp[0]
                    temp[0].isReached = true;
                    temp[0].when = Date.now() + Number(retryAfter) * 1000;
                    this.spotify_api_keys.splice(this.spotify_api_keys.indexOf(lmao), 1, temp[0]);
                } else {
                    const data = await response.json();
                    if (data?.error?.status === 401) {
                        const temp = this.spotify_api_keys.filter((item: Spotify_Key) => {
                            return item.token === token
                        });
                        const temp_key = temp[0];
                        temp_key.token = "";
                        await this.get_token(temp_key);
                        this.spotify_api_keys.splice(this.spotify_api_keys.findIndex((key: Spotify_Key) => {
                            return key.token === token
                        }), 1, temp_key)
                        token = temp_key.token;
                    }
                    else if (data.error) {
                        console.warn(url);
                        console.error(data.error)
                    }
                    else {
                        done = true;
                        return data;
                    }
                }
            }
        }
        catch (e: any) {
            console.error(e);
            return null
        }
    }

    async get_token(key: Spotify_Key) {
        if (key.token === "") {
            var client_id = key.client_id;
            var client_secret = key.key;
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
            key.token = data.access_token;
        }
    }

    async search(search: string = '', type: "video" | "playlist" | "artist" | "" = ""): Promise<Search> {
        const url = `https://api.spotify.com/v1/search?q=${search.split(" ").join("+")}&type=${type === "video" ? "track" : type.length > 0 ? type : "artist%2Cplaylist%2Ctrack"}&limit=25`
        try {
            const data = await this.fetch_data(url);
            return {
                source: "spotify",
                query: search,
                type: type as any,
                tracks: data.tracks?.items?.filter((item: any) => item != null).map((item: any) => {
                    return {
                        type: "spotify:track",
                        thumbnail: item.album?.images[item.album?.images?.length - 1]?.url ?? null,
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
                }) ?? [],
                playlists: data.playlists?.items?.filter((item: any) => item != null).map((playlist_item: any) => {
                    return {
                        type: "spotify:playlist",
                        thumbnail: playlist_item?.images[playlist_item.images?.length - 1]?.url ?? null,
                        name: playlist_item.name,
                        id: playlist_item.id,
                        duration: 0,
                        tracks: []
                    }
                }) ?? [],
                artists: data.artists?.items?.filter((item: any) => item != null).map((artist_item: any) => {
                    return {
                        type: "spotify:artist",
                        thumbnail: artist_item?.images[artist_item.images?.length - 1]?.url ?? null,
                        name: artist_item.name,
                        id: artist_item.id
                    }
                }) ?? []
            }
        }
        catch (e) {
            console.error(e);
            return null as any;
        }

    }

    async fetch_playlist(id: string = '', token?: string): Promise<Playlist> {
        let url: string = `https://api.spotify.com/v1/playlists/${id}`,
            thumbnail = "", name = "", duration = 0
        const database = this.getdata("playlists", [id])[0];
        const snapshot_id = database.etag ?? "";
        let new_snapshot_id = "";

        const tracks: any[] = [];

        try {
            while (url !== null && url !== undefined) {
                const video = await this.fetch_data(url, token);
                if (snapshot_id.length > 0 && video.snapshot_id === snapshot_id) {
                    return database as Playlist;
                }
                else {
                    if (new_snapshot_id === "") {
                        new_snapshot_id = video.snapshot_id ?? "";
                    }
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
                                source: "spotify",
                                thumbnail: item.track.album.images[item.track.album.images.length - 1]?.url || null,
                                artist: item.track.artists.map((artist: any) => {
                                    return {
                                        name: artist.name,
                                        id: artist.id
                                    }
                                }),
                                name: item.track.name,
                                id: item.track.id,
                                duration: item.track.duration_ms,
                                releasedDate: item.track.album.release_date,
                                matched: null,
                            } as Track
                        }))
                    url = video?.tracks?.next || undefined;
                }
            }
            this.writedata("playlists", [id], [{
                source: "spotify",
                name: name,
                duration: duration,
                id: id,
                thumbnail: thumbnail,
                tracks: tracks,
                etag: new_snapshot_id
            }])
            return {
                source: "spotify",
                name: name,
                duration: duration,
                id: id,
                thumbnail: thumbnail,
                tracks: tracks
            } as Playlist
        }
        catch (e) {
            console.error(e);
            return [] as unknown as Playlist;
        }
    }

    async fetch_track(ids: string[] = []): Promise<Track[]> {
        const url = `https://api.spotify.com/v1/tracks`;
        try {
            let database: Track[] = this.getdata("tracks", ids) as Track[];
            if (typeof database === "string") {
                console.error(database);
                database = []
            }

            const onDatabase = database.filter((item: any) => {
                return (item.name ?? undefined) !== undefined
            });
            const notOnDatabase = database.filter((item: any) => {
                return (item.name ?? undefined) === undefined
            });

            if (notOnDatabase.length > 0) {
                let st = 0, ed = 50;
                if (ed > notOnDatabase.length - 1) {
                    ed = notOnDatabase.length - 1;
                }
                while (st <= notOnDatabase.length - 1) {
                    const endpoint = url + `?ids=${notOnDatabase.slice(st, ed + 1).map((item: any) => item.id).join("%2C")}`
                    const track_data = await this.fetch_data(endpoint);
                    const temp = track_data?.tracks.map((item: any) => {
                        return {
                            source: "spotify",
                            thumbnail: item.album.images[item.album.images.length - 1]?.url || null,
                            artist: item.artists.map((artist: any) => {
                                return {
                                    name: artist.name,
                                    id: artist.id
                                }
                            }),
                            name: item.name,
                            id: item.id,
                            duration: item.duration_ms, // in miliseconds
                            releasedDate: item.album.release_date,
                            music_url: "",
                            matched: null
                        }
                    })
                    this.writedata("tracks", temp.map((item: Track) => item.id), temp)
                    onDatabase.push(...temp)
                    st += 50;
                    ed += 50;
                    if (ed > notOnDatabase.length - 1) {
                        ed = notOnDatabase.length - 1;
                    }
                }

            }
            return onDatabase;
        }
        catch (e) {
            console.error(e);
            return []
        }
    }

    async fetch_album(ids: string[] = ['']): Promise<Album[]> {
        const url = `https://api.spotify.com/v1/albums`;

        try {
            const result: Album[] = [];

            let st = 0, ed = 10;
            if (ed > ids.length - 1) {
                ed = ids.length - 1;
            }

            while (st <= ids.length - 1) {
                const endpoint = url + `?ids=${ids.slice(st, ed + 1).join("%2C")}`
                const data = await this.fetch_data(endpoint);
                for (const album of data.albums) {
                    result.push({
                        source: "spotify",
                        name: album.name,
                        id: album.id,
                        duration: album.tracks.items.map((item: any) => item.duration_ms).reduce((a: number, b: number) => a + b, 0),
                        releaseDate: album.release_date,
                        artists: album.artists.map((artist: any) => {
                            return {
                                name: artist.name,
                                id: artist.id
                            }
                        }),
                        thumbnail: album.images[album.images.length - 1].url,
                        tracks: album.tracks.items.map((item: any) => {
                            return {
                                source: "spotify",
                                artist: album.artists.map((artist: any) => {
                                    return {
                                        name: artist.name,
                                        id: artist.id
                                    }
                                }),
                                thumbnail: album.images[album.images.length - 1].url,
                                name: item.name,
                                id: item.id,
                                duration: item.duration_ms, // in miliseconds
                                releasedDate: album.release_date,
                                music_url: ""
                            } as Track
                        })
                    })
                }
                st += 10;
                ed += 10;
            }
            return result;
        }
        catch (e) {
            console.error(e);
            return []
        }
    }

    async fetch_artist(id: string): Promise<Artist> {
        let url = `https://api.spotify.com/v1/artists/${id}/albums?include_groups=single&limit=50`;
        const tracks: Track[] = [];
        try {
            while (url !== null && url !== undefined) {
                const data = await this.fetch_data(url);
                const ids = data.items.map((item: any) => item.id);
                const all_albums = await this.fetch_album(ids);
                for (const album of all_albums) {
                    tracks.push(...album.tracks);
                }
                url = data.next
            }
            const data = await this.fetch_data(`https://api.spotify.com/v1/artists/${id}`)
            return {
                source: "spotify",
                name: data.name,
                id: data.id,
                thumbnail: data.images[data.images.length - 1].url,
                tracks: tracks
            } as Artist;
        }
        catch (e) {
            console.error(e);
            return null as unknown as Artist;
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
            console.error(e);
            return []
        }
    }

}