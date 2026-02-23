export interface appPin {
    source: "youtube" | "spotify",
    mode: "artists" | "tracks" | "playlists" | "albums",
    id: string, thumbnail: string, name: string
}

export interface downloadQueue {
    source: "youtube" | "spotify",
    mode: "artists" | "tracks" | "playlists" | "albums",
    id: string, name: string
}

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
    matched?: string | null,
    path: string
}

export interface Search {
    query: string,
    source: string,
    type: "video" | "playlist" | "artist",
    tracks: Track[],
    playlists: Playlist[],
    artists: Artist[]
}