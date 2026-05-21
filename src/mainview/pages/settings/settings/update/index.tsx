import { faArrowsRotate } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useState } from "react";

export default function Update() {
    const [version, setVersion] = useState<string | boolean>("");

    useEffect(() => {
        const cancelled = { current: false };
        const running = setInterval(async () => {
            const data = await window.api.rpc.request.checkUpdate();
            if (!cancelled.current) setVersion(data);
        }, 1000);
        window.api.rpc.request.checkUpdate().then((data: string | boolean) => {
            if (!cancelled) setVersion(data);
        });
        return () => {
            cancelled.current = true;
            clearInterval(running);
        };
    }, []);

    return (
        <div>
            <span className="flex flex-row justify-between items-center">
                <span>
                    <FontAwesomeIcon icon={faArrowsRotate} />
                    <span className="text-lg font-semibold text-zinc-200 ml-2">
                        Version:
                    </span>
                </span>
                <span
                    className={version === true ? "hover:cursor-pointer" : ""}
                    onClick={() => {
                        if (version === true) window.api.rpc.request.update();
                    }}
                >
                    {version === true ? "Update is available!" : version}
                </span>
            </span>
        </div>
    );
}
