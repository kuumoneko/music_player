import { faFileArchive } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useState } from "react";
import fetchdata from "@/utils/fetch.ts";

export default function LocalFile() {
    const [location, setlocation] = useState("");

    useEffect(() => {
        async function run() {
            const res = await fetchdata("profile", "GET", {
                key: "folder",
            });
            setlocation(res);
        }
        run();
        const interval = window.setInterval(() => {
            run();
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const Click = async () => {
        const res = await window.api.rpc.request.setfolder();
        setlocation(res.data);
    };

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
                    <div
                        className="text-slate-800 bg-slate-100 rounded-2xl px-2"
                        onClick={Click}
                    >
                        {location.length > 0 ? location : "Select Folder"}
                    </div>
                </span>
            </span>
        </div>
    );
}
