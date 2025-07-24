import { faFileArchive } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useState } from "react";
import { post } from "../../../../../dist/function/fetch";

export default function LocalFile() {
    const [location, setlocation] = useState(localStorage.getItem("local") || "");

    // const [folder, setfolder] = useState(localStorage.getItem("local") || "")
    const handleFolderSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.value || "";
        if (files.length > 0) {
            // When a directory is selected, browser usually returns a list of files within that directory
            // You can't directly get the directory path in a secure way in most browsers.
            // However, you can extract some information.
            setlocation(files); // Get the top-level folder name
            // Alternatively, you can send the list of files to the backend if you need more details.
        }
    };

    useEffect(() => {
        async function run() {
            const data = await post("/localfile", { location: location });
            // const res = await fetch("http://localhost:3001/localfile", {
            //     method: "POST",
            //     headers: {
            //         "Content-Type": "application/json"
            //     },
            //     body: JSON.stringify({
            //         location: location
            //     })
            // });
            // const data = await res.json();
            // console.log(data);


            // setfolder(data.folder)
            localStorage.setItem("local", data.folder)

            // if (res.status === 200) {
            //     setfolder(data.folder)
            //     localStorage.setItem("local", data.folder)
            // }
        }
        // if (location === localStorage.getItem("local"))
        run();
    }, [location])

    return (
        <div>
            <span className="flex flex-row justify-between items-center">
                <span>
                    <FontAwesomeIcon icon={faFileArchive} />
                    <span className="text-lg font-semibold text-gray-800 dark:text-gray-200 ml-2">Local File:</span>
                    {/* {location && <span className="ml-2 font-mono text-sm bg-gray-200 dark:bg-gray-700 p-1 rounded">{folder}</span>} */}
                </span>

                <span>
                    {/* <label htmlFor="folder-upload" className="cursor-pointer bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-800 dark:text-gray-200 font-semibold py-1 px-3 rounded-md text-sm">
                        Select Folder
                    </label> */}
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