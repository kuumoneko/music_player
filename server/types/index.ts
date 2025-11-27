import { Request } from "express"
import Player from "../music/index.ts"

export interface Artist {
    etag?: string,
    name: string,
    id: string,
    source: "youtube" | "spotify" | "local",
    tracks: Track[],
    thumbnail: string,
    playlistId: string
}

export interface Playlist {
    etag?: string,
    name: string,
    id: string,
    source: "youtube" | "spotify" | "local",
    tracks?: Track[],
    ids?: string[],
    thumbnail: string,
    duration: number
}

export interface Album {
    etag?: string,
    name: string,
    id: string,
    source: "youtube" | "spotify" | "local",
    tracks: Track[],
    thumbnail: string,
    duration: number,
    releaseDate: string,
    artists: { id: string, name: string }[]
}

export interface Track {
    etag?: string,
    name: string,
    id: string,
    artist: { id: string, name: string }[],
    source: "youtube" | "spotify" | "local",
    thumbnail: string,
    duration: number,
    releasedDate: string // DD-MM-YYYY,
    matched?: string | null
}

export interface Search {
    query: string,
    source: string,
    type: "video" | "playlist" | "artist",
    tracks: Track[],
    playlists: Playlist[],
    artists: Artist[]
}


export interface Playing_track {
    name: string,
    duration: number,
    id: string,
    source: "youtube" | "spotify" | "local",
    thumbnail: string
}

export interface youtube_api_keys {
    ApiKey: string,
    isReached: boolean
}

export interface spotify_api_keys {
    ApiKey: string,
    ClientId: string,
    isReached: boolean,
    RetryAfter: number
}

export enum Status {
    idle = "idle",
    downloading = "downloading",
    done = "done",
    env = "env",
    prepare = "prepare"
}

export interface CustomRequest extends Request {
    download: string[],
    profile: any,
    player: Player,
}

export interface Download_item {
    id: string[],
    title: string,
    metadata: {
        artist: string,
        year: string,
        thumbnail: string,
        source: string
    }
}

export interface API_Key {
    ApiKey: string,
    isReached: boolean,
    when?: number
}