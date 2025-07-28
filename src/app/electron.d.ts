import { Audio_format } from "../types";

export interface electronAPI {
    // auth
    login: (data: { where: string }) => void,
    logout: (data: { where: string }) => void,

    // download
    download: (data: { format: Audio_format, links: [{ source: string, mode: string, id: string }] }) => void,
    download_status: () => void,

    // user
    user: () => void,
    localfile: (data: { location: string }) => void,
    local: () => void,

    // data
    search: (data: { where: string, query: string }) => void,
    track: (data: { where: string, id: string }) => void,
    playlist: (data: { where: string, id: string }) => void,
    likedsongs: (data: { where: string }) => void,
    user_playlists: () => void,
    stream: (data: { where: string, mode: string, id: string }) => void,

    // received
    onDataReceived: (callback: any) => any,
}

declare global {
    interface Window {
        electronAPI: electronAPI;
    }
}