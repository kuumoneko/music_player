export interface Download_queue {
    link: string,
    formatlink?: string,
    title: string,
    mode: string,
    format: string,
    from: string
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

export interface youtube_api_keys {
    api_key: string,
    reach_quota: boolean,
    isAuth: boolean,
    date_reached: string,
    time_reached: string
}

export interface Downloader_options {
    download_folder?: string,
    curr_folder?: string,
    audio_format?: Audio_format,
    youtube_api_key?: youtube_api_keys[],
    google_client_id?: string,
    google_client_secret?: string,
    redirect_uris?: string[],
    spotify_api_key?: string,
    spotify_client?: string,
    port?: number,
    ytb_access_token?: string,
    endpoints?: youtube_endpoints

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
    youtube_api_key?: youtube_api_keys[],
    spotify_api_key?: string,
    spotify_client?: string,
    google_client_id?: string,
    google_client_secret?: string,
    redirect_uris?: string[],
    port?: number,
    endpoints?: youtube_endpoints,
    database: string
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
    error?: string,
    pagetoken?: string,
    playlistId?: string
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

export interface youtube_endpoint {
    url: string;
    params: {
        [paramName: string]: string;
    };
}

export interface youtube_endpoints {
    [key: string]: youtube_endpoint
}

export enum EndPoints {
    User = "user",
    UserPlaylist = "userplaylist",
    LikedSongs = "likedsongs",
    PlaylistData = "playlist_data",
    PlaylistItem = "playlist_item",
    Duration = "duration",
    ContentRating = "contentRating",
    Videos = "videos",
    Search = "search",
    UserArtist = "userartist",
    Artist = "artist"
}