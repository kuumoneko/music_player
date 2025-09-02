import Audio_Settings from "./music/audio.tsx";
import Close_Settings from "./other/close.tsx";
import Spotify_Account from "./account/spotify.tsx";
import Youtube_Account from "./account/youtube.tsx";
import { goto } from "../../../utils/url.ts";
import LocalFile from "./music/localfile.tsx";

export default function SettingsModal(
    {
        url,
        isOpen,
        // preferredAudioFormat,
        // onAudioFormatChange,
        seturl
    }: {
        url: string;
        isOpen: boolean;
        // preferredAudioFormat: string;
        // onAudioFormatChange: any;
        seturl: (a: string) => void
    }
) {
    if (!isOpen) return null;

    return (
        // Overlay for the modal background
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex justify-center items-center z-50 p-4" >
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-8 w-full max-w-md space-y-6 transform transition-all duration-300 scale-100 opacity-100">

                <Close_Settings onClose={() => {
                    goto("/", seturl)
                }} />

                <Audio_Settings />

                <Youtube_Account url={url} seturl={seturl} />

                <Spotify_Account url={url} seturl={seturl} />

                <LocalFile />

                <div className="text-center pt-4 text-sm text-gray-500 dark:text-gray-400">
                    <p>Other settings will be added in the future.</p>
                </div>
            </div>
        </div>
    );
};