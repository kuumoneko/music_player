import { faFileArchive } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useState } from "react";
import { Data, fetch_data } from "../../../../utils/fetch.ts";

export default function LocalFile() {
    const [location, setlocation] = useState(localStorage.getItem("local") || "");

    const handleFolderSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.value || "";
        if (files.length > 0) {
            setlocation(files);
        }
    };

    useEffect(() => {
        if (location === undefined || location === "undefined" || location === null || location.length === 0) {
            return;
        }
        async function run() {
            const data = await fetch_data(Data.localfile, { location: location });
            localStorage.setItem("local", data.folder)
        }
        run();
    }, [location])

    return (
        <div>
            <span className="flex flex-row justify-between items-center">
                <span>
                    <FontAwesomeIcon icon={faFileArchive} />
                    <span className="text-lg font-semibold text-gray-800 dark:text-gray-200 ml-2">Local File:</span>
                </span>
                <span>
                    <input
                        id="folder-upload"
                        type="text"
                        value={location}
                        onChange={handleFolderSelect}
                        className="text-slate-500"
                    />
                </span>
            </span>
        </div >
    )
}