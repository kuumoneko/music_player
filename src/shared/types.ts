export type AppRPCType = {
    requests: {
            getMusicData: {
                params: {
                    type: MusicType, source: MusicSource, id: string
                },
                response: Track | Playlist | Artist | null
            },
            searchMusic: {
                params: { type: MusicType, source: MusicSource, query: string },
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
            getHomeFeed: {
                params: {},
                response: {
                    sections: HomeFeedSection[],
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
            toggleQuitOnClose: {
                params: null,
                response: null
            },
            isQuitOnClose: {
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
                response: unknown
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
                response: null
            },
            previous: {
                params: null,
                response: null
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
            disconnectDiscordRPC: {
                params: null,
                response: null
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
            },
            addToBatchQueue: {
                params: { source: MusicSource, type: MusicType, id: string },
                response: null
            },
            getImageDataUri: {
                params: string,
                response: string | null
            },
            createPlaylist: {
                params: { name: string },
                response: Playlist
            },
            deletePlaylist: {
                params: { id: string },
                response: void
            },
            getUserPlaylists: {
                params: {},
                response: Playlist[]
            },
            addToPlaylist: {
                params: { playlistId: string, track: Track },
                response: void
            },
            removeFromPlaylist: {
                params: { playlistId: string, trackId: string },
                response: void
            },
            getYoutubeApiKeys: {
                params: null,
                response: string[]
            },
            addYoutubeApiKey: {
                params: { key: string },
                response: string[]
            },
            removeYoutubeApiKey: {
                params: { key: string },
                response: string[]
            },
            importYoutubeApiKeys: {
                params: { keys: string[] },
                response: string[]
            },
            getYtCookies: {
                params: null,
                response: string
            },
            setYtCookies: {
                params: { cookies: string },
                response: string
            },
            clearYtCookies: {
                params: null,
                response: string
            },
            resolveThumbnailUrl: {
                params: { id: string, type: MusicType },
                response: string | null
            },
            getGoogleAuthStatus: {
                params: null,
                response: GoogleAuthState
            },
            saveGoogleCredentials: {
                params: { clientId: string, clientSecret: string },
                response: void
            },
            clearGoogleCredentials: {
                params: null,
                response: void
            },
            signInWithGoogle: {
                params: null,
                response: { success: boolean; authUrl?: string; port?: number }
            },
            signOut: {
                params: null,
                response: void
            },
            getUserYoutubePlaylists: {
                params: null,
                response: Playlist[]
            },
            getUserYoutubeSubscriptions: {
                params: null,
                response: Artist[]
            },
            getUserYoutubePlaylistTracks: {
                params: { playlistId: string },
                response: Track[]
            }
        },
        messages: {
            timeUpdate: { time: number; isPlaying: boolean }
            playerStateChange: { isPlaying: boolean; isLoading: boolean; duration: number; isLived: boolean }
            currentTrackChanged: { source: string; id: string; title: string; thumbnail: string; artist: string; artistId: string }
            settingsChanged: { shuffle: Shuffle; repeat: Repeat; volume: number }
            queueChanged: { playQueue: string[]; batchQueue: string[]; nextfrom: string; playedTrack: string[] }
            error: { message: string; stack?: string }
        }
}

export enum MusicType {
    Artist = "artist",
    Playlist = "playlist",
    Track = "track",
    Local = "local"
}

export enum MusicSource {
    Youtube = "youtube",
    Local = "local"
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
    source: MusicSource,
    tracks: Track[],
    thumbnail: string,
    playlistId: string,
    lastFetched?: number,
    cacheTtl?: number,
    etag?: string
}

export interface Playlist {
    name: string,
    id: string,
    source: MusicSource,
    tracks?: Track[],
    ids?: string[],
    thumbnail: string,
    duration: number,
    itemCount?: number,
    lastFetched?: number,
    etag?: string
}

export interface Track {
    name: string,
    id: string,
    artist: { id: string, name: string }[],
    source: MusicSource,
    thumbnail: string,
    duration: number,
    releasedDate: string,
    index?: number,
    fileModifiedAt?: number,
    youtubeTrackId?: string,
    etag?: string
}

export interface SearchResult {
    tracks: Track[],
    playlists: Playlist[],
    artists: Artist[]
}

export interface HomeFeedSection {
    title: string;
    type: "trending" | "subscriptions" | "continue_listening" | "pinned_artists" | "pinned_playlists" | "pinned_tracks" | "pinned_new_tracks" | "mixed";
    items: (Track | Artist | Playlist)[];
    itemType: "track" | "artist" | "playlist";
}

export enum Status {
    idle = "idle",
    downloading = "downloading",
    done = "done",
    env = "env",
    prepare = "prepare",
    error = "error"
}

export interface GoogleTokens {
    access_token: string;
    refresh_token: string;
    expiry_date: number;
    scope: string;
    token_type: string;
}

export interface GoogleAuthState {
    isSignedIn: boolean;
    email?: string;
    expiresAt?: number;
}

export interface UserData {
    repeat: Repeat,
    shuffle: Shuffle,
    volume: number,
    currentPlaying: {
        source: MusicSource, id: string, title: string, thumbnail: string, artist: string, artistId: string, index?: number
    },
    nextfrom: string,
    playedTrack: string[],
    QuitOnClose: boolean,
    closeToTray: boolean,
    current: {
        duration: number, isLived: boolean
    },
    isPlaying: boolean,
    isLoading: boolean,
    playQueue: string[],
    batchQueue: string[],
    folder: string,
    pin: string[],
    downloadQueue: string[],
    ytSignatureTimestamp: number,
    youtubeApiKeys: string[],
    equalizerBands: EqualizerBand[],
    equalizerEnabled: boolean,
    googleClientId?: string,
    googleClientSecret?: string,
    googleOAuthTokens?: GoogleTokens,
    googleUserEmail?: string,
    ytCookies?: string,
    youtubePlaylists?: Playlist[],
    youtubePlaylistsEtag?: string,
    youtubeSubscriptions?: Artist[],
    youtubeSubscriptionsEtag?: string
}

export interface System {
    isLocal: boolean | null,
    isDiscord: boolean | null,
    appPort: number | null,
    playerPort: number,
    DiscordClientId: number,
    googleClientId?: string,
    googleClientSecret?: string,
    youtubeApiKeys?: string[]
}

export interface EqualizerBand {
    freq: number;
    gain: number;
}

export const DEFAULT_EQ_BANDS: EqualizerBand[] = [
    { freq: 31, gain: 0 },
    { freq: 62, gain: 0 },
    { freq: 125, gain: 0 },
    { freq: 250, gain: 0 },
    { freq: 500, gain: 0 },
    { freq: 1000, gain: 0 },
    { freq: 2000, gain: 0 },
    { freq: 4000, gain: 0 },
    { freq: 8000, gain: 0 },
    { freq: 16000, gain: 0 },
];

export const EQ_PRESETS: Record<string, number[]> = {
    "Flat":         [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    "Bass Boost":   [ 6, 5, 4, 2, 0, 0, 0, 0, 0, 0],
    "Treble Boost": [ 0, 0, 0, 0, 0, 0, 2, 4, 5, 6],
    "Rock":         [ 5, 4, 2, 1, 0, 0, 1, 3, 4, 5],
    "Pop":          [ 0, 0, 0, 2, 3, 4, 3, 2, 1, 1],
    "Classical":    [ 4, 3, 2, 1, 0, 0, 0, 2, 3, 4],
};

export interface DownloadItem {
    id: string[],
    title: string,
    metadata: {
        artist: string,
        year: string,
        thumbnail: string,
        source: string
    }
}
