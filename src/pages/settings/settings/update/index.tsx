import { faArrowsRotate } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useState } from "react";

export default function Update() {
    const [version, setVersion] = useState({ current: "", latest: "" });
    useEffect(() => {
        async function run() {
            const res = await window.app.checkForUpdate();
            setVersion(res);
        }
        run();
    }, []);

    return (
        <div>
            <span className="flex flex-row justify-between items-center">
                <span>
                    <FontAwesomeIcon icon={faArrowsRotate} />
                    <span className="text-lg font-semibold text-gray-200 ml-2">
                        Version:
                    </span>
                </span>
                <span
                    className="hover:cursor-pointer"
                    onClick={() => {
                        window.app.update();
                    }}
                >
                    {version.latest !== version.current ? (
                        <a>{version.latest} is available! </a>
                    ) : (
                        <a>{version.current}</a>
                    )}
                </span>
            </span>
        </div>
    );
}
