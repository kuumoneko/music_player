export interface Download_queue {
    link: string,
    formatlink?: string,
    title: string,
    mode: string,
    format: string,
    from: string
}

export interface Link {
    trackName: string,
    trackId: string,
    authorName: string,
    thumbnail: string,
}

export interface Link_fetch {
    type: string,
    thumbnail: string,
    tracks: Link[]
}



export enum download_mode {
    video = "video",
    audio = "audio",
}


export enum Mode {
    test = "test",
    deploy = "deploy"
}

export enum Status {
    idle = "idle",
    downloading = "downloading",
    done = "done"
}


export interface Downloader_options {
    ytdlp?: string,
    spotdlp?: string,
    ffmpeg?: string,
    download_folder?: string,
    curr_folder?: string,
    spot_errors?: string,
    audio_format?: Audio_format,
    youtube_api_key?: string[],
    google_client_id?: string,
    google_client_secret?: string,
    redirect_uris?: string[],
    spotify_api_key?: string,
    spotify_client?: string
}

export interface Download_queue {
    link: string,
    formatlink?: string,
    title: string,
    mode: string,
    format: string,
    from: string
}

export interface Music_options {
    youtube_api_key?: string[],
    spotify_api_key?: string,
    spotify_client?: string,
    google_client_id?: string,
    google_client_secret?: string,
    redirect_uris?: string[],
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
    name: string,
    thumbnail?: string,
    id?: string,
    error?: string
}

export interface Track {
    type: string | "spotify:track" | "youtube:track",
    thumbnail: string | "",
    artists: Artist[],
    track: {
        name: string,
        id: string,
        duration: number | string, // in miliseconds
        releaseDate: string,
    },
    error?: string
};

export interface Album {
    type: string | "spotify:album",
    name: string,
    id: string,
    duration: number | string, // in miliseconds = sum of duration of tracks
    releaseDate: string,
    thumbnail: string,
    artists: Artist[],
    tracks: Track[],
    error?: string
}

export interface Playlist {
    type: string | "spotify:playlist" | "youtube:playlist",
    name: string,
    id: string,
    duration: number | string, // in miliseconds = sum of duration of tracks
    thumbnail: string,
    tracks: Track[],
    error?: string
}

export interface Search {
    type: string | "spotify:search" | "youtube:search",
    tracks: Track[],
    error?: string
}

export interface User {
    type: string | "spotify:user" | "youtube:user",
    name: string,
    thumbnail: string,
    error?: string
}

export const enum Server_mode {
    server = "server",
    test = "test"
}