import { Electroview } from "electrobun/view";

export { };

declare global {
    interface Window {
        YT: any, // must be had
        api: {
            rpc: {
                request: {
                    api: ({ url, mode, data }) => Promise<{ ok: boolean, data: any }>,
                    close: () => void,
                    minimize: () => void,
                    maximize: () => void,
                    downloadUpdate: () => void,
                    update: () => void,
                    checkForUpdate: () => Promise<{ ok: boolean, data: { version: string, updateAvailable: boolean, updateReady: boolean } }>,
                    checkIfRPC: () => Promise<{ ok: boolean, data: string }>,
                    connect: () => void,
                    checkIfAutostart: () => Promise<{ ok: boolean, data: boolean }>,
                    toggleAutostart: () => void,
                    setmusic: ({ track: any }) => Promise<{ ok: boolean }>,
                    clearmusic: () => void,
                    setfolder: () => Promise<{ ok: boolean, data: string }>
                }
            }
        }
    }
}