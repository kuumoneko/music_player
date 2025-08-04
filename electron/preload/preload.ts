import pkg from 'electron'
import { Audio_format } from '../types/index.js';
const { contextBridge, ipcRenderer } = pkg

contextBridge.exposeInMainWorld('electronAPI', {
    // auth
    login: (data: { where: string }) => ipcRenderer.send("login", (data)),
    logout: (data: { where: string }) => ipcRenderer.send("logout", (data)),

    // download
    download: (data: { format: Audio_format, links: [{ source: string, mode: string, id: string }] }) => ipcRenderer.send("download", (data)),
    download_status: () => ipcRenderer.send("download_status"),

    // user
    user: () => ipcRenderer.send("user"),
    localfile: (data: { location: string }) => ipcRenderer.send("localfile", (data)),
    local: () => ipcRenderer.send("local"),

    // data
    search: (data: { where: string, query: string }) => ipcRenderer.send("search", (data)),
    track: (data: { where: string, id: string }) => ipcRenderer.send("track", (data)),
    playlist: (data: { where: string, id: string }) => ipcRenderer.send("playlist", (data)),
    likedsongs: (data: { where: string }) => ipcRenderer.send("likedsongs", (data)),
    user_playlists: () => ipcRenderer.send("user_playlists"),
    stream: (data: { where: string, mode: string, id: string }) => ipcRenderer.send("stream", (data)),
    likedartists: () => ipcRenderer.send("likedartists"),

    onDataReceived: (resolve: (e: any) => void) => {
        ipcRenderer.on("received_data", (e, data: any) => resolve(data));
    },

    // close
    close: () => ipcRenderer.send("app-close")
});