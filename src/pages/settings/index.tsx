import { goto } from "@/utils/url.ts";
import LocalFile from "./settings/music/localfile.tsx";
import Close_Settings from "./settings/other/close.tsx";

function Settings({ isOpen }: { isOpen: boolean }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex justify-center items-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-8 w-full max-w-md space-y-6 transform transition-all duration-300 scale-100 opacity-100">
                <Close_Settings
                    onClose={() => {
                        goto("/");
                    }}
                />

                <LocalFile />

                <div className="text-center pt-4 text-sm text-gray-500 dark:text-gray-400">
                    <p>Other settings will be added in the future.</p>
                </div>
            </div>
        </div>
    );
}

export default Settings;
