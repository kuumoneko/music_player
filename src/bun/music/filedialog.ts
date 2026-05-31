import { dlopen } from "bun:ffi";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

export function pickFolder(appPath: string): string | null {
    const dllPath = resolve(appPath, "file_dialog.dll");
    if (!existsSync(dllPath)) {
        console.error(`[filedialog] DLL not found at ${dllPath}`);
        return null;
    }

    const bridge = dlopen(dllPath, {
        open_folder_dialog: { args: ["cstring"], returns: "cstring" },
    });

    const result = bridge.symbols.open_folder_dialog(Buffer.from("\0"));
    return result && result.length > 0 ? String(result) : null;
}
