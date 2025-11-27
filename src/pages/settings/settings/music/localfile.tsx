import { faFileArchive } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useState } from "react";
import fetch from "@/utils/fetch.ts";

export default function LocalFile() {
    const [location, setlocation] = useState("");

    useEffect(() => {
        async function run() {
            const res = await fetch("/profile/folder", "GET");
            setlocation(res);
        }
        run();
    }, []);

    const handleFolderSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.value || "";
        if (files.length > 0) {
            setlocation(files);
        }
    };

    useEffect(() => {
        if (
            location === undefined ||
            location === "undefined" ||
            location === null ||
            location.length === 0
        ) {
            return;
        }
        async function run() {
            await fetch("/profile/folder", "POST", {
                folder: location,
            });
            setlocation(location);
        }
        run();
    }, [location]);

    return (
        <div>
            <span className="flex flex-row justify-between items-center">
                <span>
                    <FontAwesomeIcon icon={faFileArchive} />
                    <span className="text-lg font-semibold text-gray-200 ml-2">
                        Local File:
                    </span>
                </span>
                <span>
                    <input
                        id="folder-upload"
                        type="text"
                        value={location}
                        onChange={handleFolderSelect}
                        className="text-slate-800 bg-slate-100 rounded-2xl px-1"
                    />
                </span>
            </span>
        </div>
    );
}
