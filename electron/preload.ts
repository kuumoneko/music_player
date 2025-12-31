import { ipcRenderer, contextBridge } from 'electron'

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('electronAPI', {
  api: (arg: any, data: any) => ipcRenderer.invoke('api', { mode: arg, data })
})
