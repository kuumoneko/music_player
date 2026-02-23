import { RPCSchema } from "electrobun"
import { Track } from "../shared/types.ts"
export type AppRPC = {
    bun: RPCSchema<{
        requests: {
            api: { params: { url: string, mode: string, data: any }, response: any },
            close: { params: {}, response: any },
            minimize: { params: {}, response: any },
            maximize: { params: {}, response: any },
            downloadUpdate: { params: {}, response: any },
            update: { params: {}, response: any },
            checkForUpdate: { params: {}, response: { current: string, latest: string } },
            checkIfRPC: { params: {}, response: string },
            connect: { params: {}, response: any },
            checkIfAutostart: { params: {}, response: boolean },
            toggleAutostart: { params: {}, response: any },
            setmusic: { params: { track: Track }, response: any },
            clearmusic: { params: {}, response: any },
            test: { params: { a: number, b: number }, response: number }
        },
        messages: {
            logToBun: {
                msg: string
            }
        }
    }>,
    webview: RPCSchema<{
        requests: {
            test: { params: { a: number, b: number }, response: number }
        },
        messages: {
            logToWebview: {
                msg: string
            }
        }
    }>
}