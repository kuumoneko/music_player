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

export interface PlayingUrl {
    id: string,
    url: string,
    source: "youtube" | "spotify" | "local"
}

export interface Api_key {
    key: string,
    client_id?: string,
    isReached: boolean
    when: number
}

export interface PlayerOption {
    youtube_api_keys: Api_key[],
    spotify_api_keys: Api_key[]
}

export enum sleep_types {
    no = "nosleep",
    five = "after 5 minutes",
    ten = "after 10 minutes",
    tenfive = "after 15 minutes",
    threeten = "after 30 minutes",
    fourfive = "after 45 minutes",
    hour = "after 1 hours",
    eot = "end of this track"
}