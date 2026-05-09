import { useState } from "react";
import { SleepMode } from "@/shared/types.ts";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBed } from "@fortawesome/free-solid-svg-icons";

export default function SleepUI() {
    const sleep_type = [
        "nosleep",
        "after 5 minutes",
        "after 10 minutes",
        "after 15 minutes",
        "after 30 minutes",
        "after 45 minutes",
        "after 1 hours",
        "end of this track",
    ];
    const [sleep, setsleep] = useState(SleepMode.no);
    const [isHover, setIsHover] = useState(false);

    const Sleep_comp = () => {
        switch (sleep) {
            case SleepMode.no:
                return (
                    <span className="w-full flex flex-row-reverse">none</span>
                );
            case SleepMode.five:
                return <span className="w-full flex flex-row-reverse">5</span>;
            case SleepMode.ten:
                return <span className="w-full flex flex-row-reverse">10</span>;
            case SleepMode.fifteen:
                return <span className="w-full flex flex-row-reverse">15</span>;
            case SleepMode.thirty:
                return <span className="w-full flex flex-row-reverse">30</span>;
            case SleepMode.fourtyfive:
                return <span className="w-full flex flex-row-reverse">45</span>;
            case SleepMode.hour:
                return (
                    <span className="w-full flex flex-row-reverse">1 hour</span>
                );
            default:
                return (
                    <span className="w-full flex flex-row-reverse">End</span>
                );
        }
    };

    return (
        <div
            className="flex flex-row"
            onMouseEnter={() => setIsHover(true)}
            onMouseLeave={() => setIsHover(false)}
        >
            <span className="w-15  mr-1.25 flex flex-row-reverse">
                <Sleep_comp />
            </span>
            <span
                className={`mr-2.5 px-1 py-0.5 ${!isHover ? "" : "rounded-full bg-zinc-500 cursor-pointer"}`}
                onClick={() => {
                    const index = sleep_type.indexOf(sleep);
                    const temp = sleep_type[
                        (index + 1) % sleep_type.length
                    ] as SleepMode;
                    window.api.rpc.request.setSleep(temp);
                    setsleep(temp);
                }}
            >
                <FontAwesomeIcon icon={faBed} />
            </span>
        </div>
    );
}
