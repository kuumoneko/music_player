import { Electroview } from "electrobun/view";
import { Album, Artist, Playlist, Track, UserData, UserProfile } from "./types.ts";

export { };

declare global {
    interface Window {
        YT: any, // must be had for Youtube Iframe API
        api: {
            rpc: {
                request: {
                    // main
                    getMusicData: ({ source, type, id }: { source: "youtube" | "local", type: "tracks" | "playlists" | "artists", id: string }) => Promise<Track | Album | Playlist | Artist | null>,
                    getLocalfile: () => Promise<Track[]>,
                    searchMusic: ({ type, query }: { type: "video" | "playlist" | "artist", query: string }) => Promise<{ tracks: Track[], playlists: Playlist[], artists: Artist[] }>
                    getHomeData: () => Promise<{ artists: Artist[], playlists: Playlist[], tracks: Track[], newTracks: Track[] }>,
                    getProfileData: <K extends keyof UserProfile>(key: K) => Promise<UserProfile[K]>,
                    setProfileData: <K extends keyof UserProfile>({ key, data }: { key: K, data: UserProfile[K] }) => Promise<void | string>,
                    downloadMusic: () => Promise<string>,
                    getDownloadStatus: () => Promise<{ data: string, track: string }>,
                    close: () => Promise<void>,
                    minimize: () => Promise<void>,
                    toggleMaximize: () => Promise<void>,
                    toggleQuitonClose: () => Promise<void>,
                    isQuitonClose: () => Promise<boolean>,
                    togglePlayPause: () => Promise<void>,
                    getUserData: <K extends keyof UserData> (key: K) => Promise<UserData[K]>,
                    setUserData: <K extends keyof UserData>({ key, data }: { key: K, data: UserData[K] }) => Promise<void>,
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
                    checkUpdate: () => Promise<boolean | string>,
                    update: () => Promise<void>,
                    isHasDiscordRPC: () => Promise<boolean | string>,
                    connectDiscordRPC: () => Promise<string>,
                    isAutoStart: () => Promise<boolean>,
                    toggleAutoStart: () => Promise<void>,
                    // player
                    seekToPlayer: (time: number) => Promise<void>,
                    setVolume: (volume: number) => Promise<void>,
                    playTrack: (track: { source: string, id: string, title: string, thumbnail: string, artist: string }) => Promise<void>,
                    togglePlayPause: () => Promise<void>,

                    //getTrack: () => Promise<ArrayBuffer>,
                    endTrack: () => Promise<void>,
                    sleep: () => Promise<void>,
                    setLoading: (isLoading: boolean) => Promise<void>
                    setcurrentTime: (time: number) => Promise<void>
                    setDuration: (time: number) => Promise<void>
                    setIsPlaying: (isPlaying: boolean) => Promise<void>

                }
            }
        }
    }
}