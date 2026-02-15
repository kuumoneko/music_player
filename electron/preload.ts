import { ipcRenderer, contextBridge } from 'electron'

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('electronAPI', {
  api: (arg: any, data: any) => ipcRenderer.invoke('api', { mode: arg, data }),
  close: () => ipcRenderer.invoke('close'),
  minimize: () => ipcRenderer.invoke('minimize'),
  maximize: () => ipcRenderer.invoke('maximize'),
})

contextBridge.exposeInMainWorld("discord", {
  setmusic: (track: any) => ipcRenderer.invoke("discord", { url: "setmusic", data: track }),
  clearmusic: () => ipcRenderer.invoke("discord", { url: "clearmusic" })
})

contextBridge.exposeInMainWorld("app", {
  checkForUpdate: () => ipcRenderer.invoke("app", { url: "cfu" }),
  connect: () => ipcRenderer.invoke("app", { url: "RPC" }),
  checkIfRPC: () => ipcRenderer.invoke("app", { url: "cid" }),
  update: () => ipcRenderer.invoke("app", { url: "update" }),
  checkIfAutostart: () => ipcRenderer.invoke("app", { url: "cia" }),
  toggleAutostart: () => ipcRenderer.invoke("app", { url: "autostart" })
})