import { goto } from "@/mainview/utils/url.ts";
import LocalFile from "./settings/local/index.tsx";
import Close_Settings from "./settings/other/close.tsx";
import Discord from "./settings/discord/index.tsx";
import Update from "./settings/update/index.tsx";

function Settings({ isOpen }: { isOpen: boolean }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-zinc-900 bg-opacity-75 flex justify-center items-center z-50 p-4">
            <div className="bg-zinc-800 rounded-xl shadow-2xl p-8 w-full max-w-md space-y-6 transform transition-all duration-300 scale-100 opacity-100">
                <Close_Settings
                    onClose={() => {
                        goto("/");
                    }}
                />

                <LocalFile />

                <Discord />

                <Update />

                <div className="text-center pt-4 text-sm text-zinc-400">
                    <p>Other settings will be added in the future.</p>
                </div>
            </div>
        </div>
    );
}

export default Settings;
