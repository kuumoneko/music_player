import localstorage from "@/utils/localStorage.ts";
import { goto, Force } from "@/utils/url.ts";
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
        localstorage("get", "backward", [])
    );
    const [forward, setforward] = useState(
        localstorage("get", "forward", [])
    );

    useEffect(() => {
        const run = setInterval(() => {
            setbackward(localstorage("get", "backward", []));
            setforward(localstorage("get", "forward", []));
        }, 100);
        return () => clearInterval(run);
    }, []);

    return (
        <div className="controlpanel flex flex-row gap-2.5">
            <span
                className={`material-icons flex items-center gap-1.25 text-white cursor-default select-none ${
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
                className={`material-icons flex items-center gap-1.25 text-white cursor-default select-none`}
                onClick={() => {
                    window.location.reload();
                }}
            >
                <FontAwesomeIcon icon={faArrowsRotate} />
            </span>
            <span
                className={`material-icons flex items-center gap-1.25 text-white cursor-default select-none ${
                    forward.length === 0 ? "opacity-50 pointer-events-none" : ""
                }`}
                onClick={() => {
                    const temp = forward.shift() ?? "/";
                    goto(temp, Force.Forward);
                }}
            >
                <FontAwesomeIcon icon={faArrowRight} />
            </span>
            <span
                className={`material-icons flex items-center gap-1.25 text-white cursor-default select-none`}
                onClick={() => {
                    goto("/local");
                }}
            >
                <FontAwesomeIcon icon={faDatabase} />
            </span>
            <span
                className="material-icons flex items-center gap-1.25 text-white cursor-default select-none"
                onClick={() => {
                    goto("/queue/play");
                }}
            >
                <FontAwesomeIcon icon={faList} />
            </span>
            <span
                className="material-icons flex items-center gap-1.25 text-white cursor-default select-none"
                onClick={() => {
                    goto("/queue/download");
                }}
            >
                <FontAwesomeIcon icon={faDownload} />
            </span>
        </div>
    );
}
