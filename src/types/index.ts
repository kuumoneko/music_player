export enum Mode {
    react = "testreact",
    app = "testapp",
    deploy = "deploy"
}

export enum Status {
    idle = "idle",
    downloading = "downloading",
    done = "done",
    env = "env",
    prepare = "prepare"
}

export interface Download_queue {
    link: string,
    formatlink?: string,
    title: string,
    mode: string,
    format: string,
    from: string
}

export enum Audio_format {
    aac = "aac",
    alac = "alac",
    flac = "flac",
    m4a = "m4a",
    mp3 = "mp3",
    opus = "opus",
    vorbis = "vorbis",
    wav = "wav"
}

export interface Artist {
    type?: string | "spotify:artist" | "youtube:artist",
    tracks?: Track[],
    name: string,
    thumbnail?: string,
    id?: string,
    error?: string
}

export interface User_Artist {
    type?: string | "spotify:artist" | "youtube:artist",
    artists?: Artist[],
    error?: string
}

export interface Track {
    type: string | "spotify:track" | "youtube:track",
    thumbnail?: string | "",
    artists?: Artist[],
    track?: {
        name: string,
        id: string,
        duration: number | string, // in miliseconds
        releaseDate: string,
    },
    error?: string
};

export interface Album {
    type: string | "spotify:album",
    name?: string,
    id?: string,
    duration?: number | string, // in miliseconds = sum of duration of tracks
    releaseDate?: string,
    thumbnail?: string,
    artists?: Artist[],
    tracks?: Track[],
    error?: string
}

export interface Playlist {
    type: string | "spotify:playlist" | "youtube:playlist",
    name?: string,
    id?: string,
    duration?: number | string, // in miliseconds = sum of duration of tracks
    thumbnail?: string,
    tracks?: Track[],
    error?: string,
    pagetoken?: string
}

interface PlaylistItem {
    playlistName: string,
    playlistId: string,
    authorName: string,
    thumbnail: string
}

export interface UserPlaylist {
    type: string | "spotify:playlist" | "youtube:playlist",
    playlists?: PlaylistItem[],
    error?: string
}

export interface Search {
    type: string | "spotify:search" | "youtube:search",
    tracks?: Track[],
    error?: string
}

export interface User {
    type: string | "spotify:user" | "youtube:user",
    name?: string,
    thumbnail?: string,
    error?: string
}

export const enum Server_mode {
    server = "server",
    test = "test"
}