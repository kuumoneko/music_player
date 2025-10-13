import { faFileAudio } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useState } from "react";
import fetch_profile, {
    LocalStorageKeys,
} from "../../../../utils/localStorage";

export default function Audio_Settings() {
    const [audio, setaudio] = useState("");

    useEffect(() => {
        async function run() {
            const res = await fetch_profile("get", LocalStorageKeys.audio);
            setaudio(res);
        }
        run();
    }, []);
    return (
        <div className="flex flex-row justify-between">
            <span>
                <FontAwesomeIcon icon={faFileAudio} />
                <span className="text-lg font-semibold text-gray-800 dark:text-gray-200 ml-2">
                    File extension
                </span>
            </span>

            <select
                value={audio}
                onChange={(e) => {
                    setaudio(e.target.value);
                    async function run() {
                        const res = await fetch_profile(
                            "write",
                            LocalStorageKeys.audio,
                            e.target.value as string
                        );
                    }
                    run();
                }}
                className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
                <option value="mp3">MP3</option>
                <option value="m4a">M4A</option>
            </select>
        </div>
    );
}
