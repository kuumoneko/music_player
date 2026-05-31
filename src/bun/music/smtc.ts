import { dlopen } from "bun:ffi";
import EventEmitter from "node:events";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

export default class SMTC extends EventEmitter {
    private bridge: any = null;
    private appPath: string = "";
    private pollTimer: NodeJS.Timeout | undefined;

    constructor(appPath: string) {
        super();
        this.appPath = appPath;
        this.init();
    }

    init() {
        const dllPath = resolve(this.appPath, "smtc.dll");
        if (!existsSync(dllPath)) {
            throw new Error(`SMTC DLL not found at ${dllPath}`);
        }
        this.bridge = dlopen(dllPath, {
            smtc_init: { args: [], returns: "bool" },
            smtc_update_metadata: { args: ["cstring", "cstring", "cstring", "bool"], returns: "void" },
            smtc_set_playback_state: { args: ["bool"], returns: "void" },
            smtc_set_enabled_buttons: { args: ["bool", "bool", "bool", "bool"], returns: "void" },
            smtc_poll_button: { args: [], returns: "int" },
            smtc_destroy: { args: [], returns: "void" },
        })
        const sym = this.bridge.symbols;
        if (!sym.smtc_init()) { throw new Error("smtc_init returned false"); }
        sym.smtc_set_enabled_buttons(true, true, true, true);
        this.startPolling();
        this.emit("ready");
    }

    private startPolling() {
        this.pollTimer = setInterval(() => {
            try {
                const code = this.bridge.symbols.smtc_poll_button();
                if (code === 0 || code === 1) {
                    this.emit("toggle");
                } else if (code === 2) {
                    this.emit("next");
                } else if (code === 3) {
                    this.emit("previous");
                }
            } catch { }
        }, 100);
    }

    decode(data: string) {
        return Buffer.from(data + "\0");
    }

    updateMetadata(title: string, artist: string, thumbnail: string, isList: boolean) {
        this.bridge.symbols.smtc_update_metadata(this.decode(title ?? ""), this.decode(artist ?? ""), this.decode(thumbnail ?? ""), isList ?? false);
    }

    setPlaybackState(playing: boolean) {
        this.bridge.symbols.smtc_set_playback_state(playing);
    }

    exit() {
        if (this.pollTimer) clearInterval(this.pollTimer);
        this.bridge.symbols.smtc_destroy();
    }
}
