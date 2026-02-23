import { faArrowsRotate } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useState } from "react";

export default function Update() {
    const [version, setVersion] = useState({
        version: "",
        updateAvailable: false,
        updateReady: false,
    });
    useEffect(() => {
        async function run() {
            const res = await window.api.rpc.request.checkForUpdate();
            setVersion(res.data);
        }
        run();
        const interval = window.setInterval(() => {
            run();
        }, 1000);
        return () => clearInterval(interval);
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
                        window.api.rpc.request.update();
                    }}
                >
                    {version.updateAvailable
                        ? version.updateReady
                            ? "Update ready to install!"
                            : "Update is available!"
                        : version.version.length > 0
                          ? version.version
                          : "0.0.0"}
                </span>
            </span>
        </div>
    );
}
