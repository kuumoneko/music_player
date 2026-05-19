import localstorage from "@/mainview/utils/localStorage.ts";
import { goto, Force } from "@/mainview/utils/url.ts";
import {
    faArrowLeft,
    faArrowsRotate,
    faArrowRight,
    faDownload,
    faList,
    faDatabase,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useState } from "react";

export default function ControlPanel() {
    const [backward, setbackward] = useState(
        localstorage("get", "backward", []),
    );
    const [forward, setforward] = useState(localstorage("get", "forward", []));
    const [isLocal, setIsLocal] = useState(true);

    useEffect(() => {
        const onForwardChange = (e: Event) => {
            setforward((e as CustomEvent).detail);
        };
        const onBackwardChange = (e: Event) => {
            setbackward((e as CustomEvent).detail);
        };
        window.addEventListener("forwardchange", onForwardChange);
        window.addEventListener("backwardchange", onBackwardChange);
        return () => {
            window.removeEventListener("forwardchange", onForwardChange);
            window.removeEventListener("backwardchange", onBackwardChange);
        };
    }, []);

    useEffect(() => {
        let cancelled = false;
        window.api.rpc.request
            .getSystem("isLocal")
            .then((data) => { if (!cancelled) setIsLocal(data); });
        return () => { cancelled = true; };
    }, []);

    return (
        <div className="controlpanel flex flex-row gap-2.5 w-1/5">
            <span
                className={`material-icons rounded-full px-0.5 py-1 hover:cursor-pointer hover:bg-zinc-500 flex items-center gap-1.25 text-white cursor-default select-none ${
                    backward.length === 0
                        ? "opacity-50 pointer-events-none"
                        : ""
                }`}
                onClick={() => {
                    const temp = backward.pop() ?? "/";
                    goto(temp, Force.Backward);
                }}
            >
                <FontAwesomeIcon icon={faArrowLeft} />
            </span>
            <span
                className={`material-icons rounded-full px-0.5 py-1 hover:cursor-pointer hover:bg-zinc-500 flex items-center gap-1.25 text-white cursor-default select-none`}
                onClick={() => {
                    window.location.reload();
                }}
            >
                <FontAwesomeIcon icon={faArrowsRotate} />
            </span>
            <span
                className={`material-icons rounded-full px-0.5 py-1 hover:cursor-pointer hover:bg-zinc-500 flex items-center gap-1.25 text-white cursor-default select-none ${
                    forward.length === 0 ? "opacity-50 pointer-events-none" : ""
                }`}
                onClick={() => {
                    const temp = forward.shift() ?? "/";
                    goto(temp, Force.Forward);
                }}
            >
                <FontAwesomeIcon icon={faArrowRight} />
            </span>
            {isLocal && (
                <span
                    className={`material-icons rounded-full px-0.5 py-1 hover:cursor-pointer hover:bg-zinc-500 flex items-center gap-1.25 text-white cursor-default select-none`}
                    onClick={() => {
                        goto("/local");
                    }}
                >
                    <FontAwesomeIcon icon={faDatabase} />
                </span>
            )}
            <span
                className="material-icons rounded-full px-0.5 py-1 hover:cursor-pointer hover:bg-zinc-500 flex items-center gap-1.25 text-white cursor-default select-none"
                onClick={() => {
                    goto("/queue/play");
                }}
            >
                <FontAwesomeIcon icon={faList} />
            </span>
            {isLocal && (
                <span
                    className="material-icons rounded-full px-0.5 py-1 hover:cursor-pointer hover:bg-zinc-500 flex items-center gap-1.25 text-white cursor-default select-none"
                    onClick={() => {
                        goto("/queue/download");
                    }}
                >
                    <FontAwesomeIcon icon={faDownload} />
                </span>
            )}
        </div>
    );
}
