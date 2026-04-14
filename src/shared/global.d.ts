import { Electroview } from "electrobun/view";
import { Album, Artist, Playlist, Repeat, Shuffle, System, Track, UserData, UserProfile } from "./types.ts";

export { };

declare global {
    interface Window {
        api: {
            rpc: {
                request: {
                    // main
                    getMusicData: ({ source, type, id }: { source: "youtube" | "local", type: "tracks" | "playlists" | "artists", id: string }) => Promise<Track | Album | Playlist | Artist | null>,
                    getLocalfile: () => Promise<Track[]>,
                    searchMusic: ({ type, query }: { type: "video" | "playlist" | "artist", query: string }) => Promise<{ tracks: Track[], playlists: Playlist[], artists: Artist[] }>
                    getHomeData: () => Promise<{ artists: Artist[], playlists: Playlist[], tracks: Track[], newTracks: Track[] }>,
                    downloadMusic: () => Promise<string>,
                    getDownloadStatus: () => Promise<{ data: string, track: string }>,
                    // action
                    close: () => Promise<void>,
                    minimize: () => Promise<void>,
                    toggleQuitonClose: () => Promise<void>,
                    isQuitonClose: () => Promise<boolean>,

                    getSystem: <K extends keyof System> (key: K) => Promise<System[K]>,
                    // User Data
                    getUserData: <K extends keyof UserData> (key: K) => Promise<UserData[K]>,
                    setUserData: <K extends keyof UserData>({ key, data }: { key: K, data: UserData[K] }) => Promise<void | string>,
                    getPlayingData: () => Promise<{
                        shuffle: Shuffle,
                        repeat: Repeat,
                        isPlaying: boolean,
                        isLoading: boolean,
                        playedTrack: boolean,
                        current: {
                            time: number, duration: number, isLived: boolean
                        }
                    }>,
                    // player
                    togglePlayPause: () => Promise<void>,
                    play: ({ item, source, type, id }: { item: Track, source: "youtube" | "local", type: "track" | "playlist" | "artist", id: string }) => Promise<{
                        source: "youtube" | "local",
                        id: string,
                        title: string,
                        thumbnail: string,
                        artist: string
                    }>,
                    next: () => Promise<void>,
                    previous: () => Promise<void>,
                    seekTo: (time: number) => Promise<void>,
                    setSleep: (mode: string) => Promise<void>,
                    setVolume: (volume: number) => Promise<void>,
                    sendError: (error: Error) => Promise<void>,

                    checkUpdate: () => Promise<boolean | string>,
                    update: () => Promise<void>,
                    isHasDiscordRPC: () => Promise<boolean | string>,
                    connectDiscordRPC: () => Promise<string>,
                }
            }
        }
    }
}