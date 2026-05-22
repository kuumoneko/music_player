import type { RPCSchema } from "electrobun"

export type AppRPCType = {
    bun: RPCSchema<{
        requests: {
            getMusicData: {
                params: {
                    type: "youtube" | "local", id: string
                },
                response: Track | Playlist | Artist | null
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
            getIsLocal: {
                params: null,
                response: boolean
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
                response: UserData[keyof UserData]
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
                    playedTrack: string[],
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
            getQueueData: {
                params: string[],
                response: (Track | Playlist | Artist | null)[]
            },
            setFolder: {
                params: null,
                response: string // folder full path
            },
            sendError: {
                params: Error,
                response: void
            },
            openDevTools: {
                params: null,
                response: void
            }
        },
        messages: {
            timeUpdate: { time: number; isPlaying: boolean }
            playerStateChange: { isPlaying: boolean; isLoading: boolean; duration: number; isLived: boolean }
            currentTrackChanged: { source: string; id: string; title: string; thumbnail: string; artist: string }
            settingsChanged: { shuffle: Shuffle; repeat: Repeat; volume: number }
            queueChanged: { playQueue: string[]; nextfrom: string; playedTrack: string[] }
        }
    }>,
    webview: RPCSchema<{
        requests: {},
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
    fortyfive = "after 45 minutes",
    hour = "after 1 hour",
    eot = "end of this track"
}

export interface Artist {
    name: string,
    id: string,
    source: "youtube" | "local",
    tracks: Track[],
    thumbnail: string,
    playlistId: string
}

export interface Playlist {
    name: string,
    id: string,
    source: "youtube" | "local",
    tracks?: Track[],
    ids?: string[],
    thumbnail: string,
    duration: number
}

export interface Track {
    name: string,
    id: string,
    artist: { id: string, name: string }[],
    source: "youtube" | "local",
    thumbnail: string,
    duration: number,
    releasedDate: string // DD-MM-YYYY,
    index?: number // this is for local file,
    fileModifiedAt?: number // mtime ms for local file cache invalidation,
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
    currentPlaying: {
        source: string, id: string, title: string, thumbnail: string, artist: string, index?: number
    },
    nextfrom: string,
    playedTrack: string[],
    QuitonClose: boolean,
    current: {
        duration: number, isLived: boolean
    },
    isPlaying: boolean,
    isLoading: boolean,
    playQueue: string[],
    folder: string,
    pin: string[],
    downloadQueue: string[],
    ytSignatureTimestamp: number
}

export interface System {
    youtubeApiKeys: string[],
    isLocal: boolean,
    isDiscord: boolean,
    appPort: number,
    playerPort: number,
    DiscordClientId: number
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