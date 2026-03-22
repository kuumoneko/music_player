import { faArrowsRotate } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useState } from "react";

export default function Update() {
    const [version, setVersion] = useState<string | boolean>("");
    useEffect(() => {
        window.api.rpc.request.checkUpdate().then((data: string | boolean) => {
            setVersion(data);
        });
        
        const interval = window.setInterval(() => {
            window.api.rpc.request
                .checkUpdate()
                .then((data: string | boolean) => {
                    setVersion(data);
                });
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
                    {version === true ? "Update is available!" : version}
                </span>
            </span>
        </div>
    );
}
