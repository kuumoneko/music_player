import pkg from 'electron'
// import { Audio_format } from './types/index.ts';
const { contextBridge, ipcRenderer } = pkg


contextBridge.exposeInMainWorld('electronAPI', {
    // auth
    login: (data) => ipcRenderer.send("login", (data)),
    logout: (data) => ipcRenderer.send("logout", (data)),

    // download
    download: (data) => ipcRenderer.send("download", (data)),
    download_status: () => ipcRenderer.send("download_status"),

    // user
    user: () => ipcRenderer.send("user"),
    localfile: (data) => ipcRenderer.send("localfile", (data)),
    local: () => ipcRenderer.send("local"),

    // data
    search: (data) => ipcRenderer.send("search", (data)),
    track: (data) => ipcRenderer.send("track", (data)),
    playlist: (data) => ipcRenderer.send("playlist", (data)),
    likedsongs: (data) => ipcRenderer.send("likedsongs", (data)),
    user_playlists: () => ipcRenderer.send("user_playlists"),
    stream: (data => ipcRenderer.send("stream", (data))),


    // received
    onDataReceived: (callback) => ipcRenderer.on("received_data", (event, data) => callback(data)),
});