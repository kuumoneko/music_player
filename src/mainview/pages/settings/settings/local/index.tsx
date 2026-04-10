import { faFileArchive } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useState } from "react";

export default function LocalFile() {
    const [location, setlocation] = useState("");

    useEffect(() => {
        async function run() {
            window.api.rpc.request
                .getUserData("folder")
                .then((data) => setlocation(data));
        }
        run();
        const interval = window.setInterval(() => {
            run();
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    if (location === null) {
        return <></>;
    }

    const Click = async () => {
        window.api.rpc.request
            .setUserData({
                key: "folder",
                data: "",
            })
            .then((data) => setlocation((data as string) ?? ""));
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
