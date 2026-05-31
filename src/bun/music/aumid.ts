import { dlopen } from "bun:ffi";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

let _registered = false;

export function registerAumid(appPath: string): boolean {
    if (_registered) return true;

    const dllPath = resolve(appPath, "aumid.dll");
    if (!existsSync(dllPath)) {
        console.error(`[aumid] DLL not found at ${dllPath}`);
        return false;
    }

    let launcherPath = resolve(appPath, "launcher.exe");
    if (!existsSync(launcherPath)) {
        launcherPath = resolve(appPath, "bin", "launcher.exe");
    }

    const bridge = dlopen(dllPath, {
        register_aumid: { args: ["cstring", "cstring"], returns: "bool" },
    });

    const ok = bridge.symbols.register_aumid(Buffer.from(launcherPath + "\0"), Buffer.from("musicapp.kuumo.dev\0"));
    if (ok) {
        _registered = true;
    }
    return ok;
}
