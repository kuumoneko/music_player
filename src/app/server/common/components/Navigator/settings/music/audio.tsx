import { faFileAudio } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";


// Audio format settings
export default function Audio_Settings({ preferredAudioFormat, onAudioFormatChange }: {
    preferredAudioFormat: string;
    onAudioFormatChange: () => void;
}) {
    return (

        <div className="flex flex-row justify-between">
            <span>
                <FontAwesomeIcon icon={faFileAudio} />
                <span className="text-lg font-semibold text-gray-800 dark:text-gray-200 ml-2">File extension</span>
            </span>

            <select
                value={preferredAudioFormat}
                onChange={onAudioFormatChange}
                className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
                <option value="mp3">MP3</option>
                <option value="m4a">M4A</option>
                <option value="wav">WAV</option>
            </select>
        </div >
    )
}