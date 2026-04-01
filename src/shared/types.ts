import type { RPCSchema } from "electrobun"

export type AppRPCType = {
    bun: RPCSchema<{
        requests: {
            getMusicData: {
                params: {
                    type: "youtube" | "local", id: string
                },
                response: Track | Album | Playlist | Artist | null
            },
            searchMusic: {
                params: { type: "video" | "playlist" | "artist", query: string },
                response: { tracks: Track[], playlists: Playlist[], artists: Artist[] }
            },
            getHomeData: {
                params: {},
                response: {
                    artists: Artist[],
                    playlists: Playlist[],
                    tracks: Track[],
                    newTracks: Track[],
                }
            },
            getSystem: {
                params: keyof System,
                response: any
            },
            getProfileData: {
                params: keyof UserProfile,
                response: any
            },
            setProfileData: {
                params: { key: keyof UserProfile, data: any },
                response: any
            },
            downloadMusic: {
                params: null,
                response: string
            },
            getDownloadStatus: {
                params: null,
                response: { data: string, track: string }
            },
            close: {
                params: null,
                response: null
            },
            minimize: {
                params: null,
                response: null
            },
            toggleQuitonClose: {
                params: null,
                response: null
            },
            isQuitonClose: {
                params: null,
                response: boolean
            },
            togglePlayPause: {
                params: null,
                response: null
            },
            getUserData: {
                params: keyof UserData,
                response: any
            },
            setUserData: {
                params: { key: keyof UserData, data: string },
                response: any
            },
            getPlayingData: {
                params: null,
                response: {
                    shuffle: Shuffle,
                    repeat: Repeat,
                    isPlaying: boolean,
                    isLoading: boolean,
                    playedTrack: boolean,
                    current: {
                        time: number, duration: number
                    }
                }
            },
            next: {
                params: null,
                response: {
                    source: string, id: string, title: string, thumbnail: string, artist: string
                }
            },
            previous: {
                params: null,
                response: {
                    source: string, id: string, title: string, thumbnail: string, artist: string
                }
            },
            seekTo: {
                params: number,
                response: null
            },
            setSleep: { params: SleepMode, response: null },
            checkUpdate: {
                params: null,
                response: boolean | string
            },
            update: {
                params: null,
                response: null
            },
            isHasDiscordRPC: {
                params: null,
                response: boolean | string
            },
            connectDiscordRPC: {
                params: null,
                response: string // username
            },
            setFolder: {
                params: null,
                response: string // folder full path
            },
        },
        messages: {}
    }>,
    webview: RPCSchema<{
        requests: {},
        messages: {}
    }>
}

export type PlayerRPCType = {
    bun: RPCSchema<{
        requests: {
            getTrack: {
                params: null,
                response: ArrayBuffer
            },
            endTrack: {
                params: null,
                response: {
                    source: string, id: string, title: string, thumbnail: string, artist: string
                }
            },
            sleep: {
                params: null,
                response: null
            },
        },
        messages: {}
    }>,
    webview: RPCSchema<{
        requests: {
            seekTo: {
                params: number,
                response: null
            },
            setVolume: {
                params: number,
                response: null
            },
            playTrack: {
                params: {
                    source: string, id: string, title: string, thumbnail: string, artist: string
                },
                response: null
            },
            togglePlayPause: {
                params: null,
                response: null
            },
            setIsRepeat: {
                params: boolean,// repeat one mode is true
                response: null
            },
            setSleep: {
                params: SleepMode,
                response: null
            },
        },
        messages: {}
    }>
}

export enum Shuffle {
    Disable = 0,
    Enable = 1
}

export enum Repeat {
    Disable = 0,
    One = 1,
    All = 2
}

export enum SleepMode {
    no = "nosleep",
    five = "after 5 minutes",
    ten = "after 10 minutes",
    fifteen = "after 15 minutes",
    thirty = "after 30 minutes",
    fourtyfive = "after 45 minutes",
    hour = "after 1 hours",
    eot = "end of this track"
}

export interface Artist {
    etag?: string,
    name: string,
    id: string,
    source: "youtube" | "local",
    tracks: Track[],
    thumbnail: string,
    playlistId: string
}

export interface Playlist {
    etag?: string,
    name: string,
    id: string,
    source: "youtube" | "local",
    tracks?: Track[],
    ids?: string[],
    thumbnail: string,
    duration: number
}

export interface Album {
    etag?: string,
    name: string,
    id: string,
    source: "youtube" | "local",
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
    source: "youtube" | "local",
    thumbnail: string,
    duration: number,
    releasedDate: string // DD-MM-YYYY,
    matched?: string | null, index?: number // this is for local file
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
    source: "youtube" | "local",
    thumbnail: string
}

export enum Status {
    idle = "idle",
    downloading = "downloading",
    done = "done",
    env = "env",
    prepare = "prepare"
}

export interface UserData {
    repeat: Repeat,
    shuffle: Shuffle,
    volume: number,
    height: number, width: number,
    currentPlaying: {
        source: string, id: string, title: string, thumbnail: string, artist: string, index?: number
    },
    queue: Track[],
    isMaximized: boolean, nextfrom: { from: string, next: Track[] },
    playedTrack: string[],
    QuitonClose: boolean,
    current: {
        time: number, duration: number
    },
    isPlaying: boolean,
    isLoading: boolean
}

export interface UserProfile {
    play: string[],
    local: string[],
    folder: string,
    pin: { id: string, source: string, type: string, thumbnail: string, name: string }[],
    download: {
        name: string, source: string, mode: string, id: string
    }[]
}

export interface System {
    youtubeApiKeys: string[],
    isLocal: boolean,
    isDiscord: boolean,
    appPort: number,
    playerPort: number
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