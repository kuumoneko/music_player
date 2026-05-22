import { faFileArchive } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useState } from "react";

export default function LocalFile() {
    const [location, setlocation] = useState("");

    useEffect(() => {
        window.api.rpc.request.getUserData("folder").then((data) => {
            setlocation(data);
        });
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
                    <span className="text-lg font-semibold text-zinc-200 ml-2">
                        Local File:
                    </span>
                </span>
                <span>
                    <div
                        className="text-zinc-800 bg-zinc-100 rounded-2xl px-2"
                        onClick={Click}
                    >
                        {location.length > 0 ? location : "Select Folder"}
                    </div>
                </span>
            </span>
        </div>
    );
}
