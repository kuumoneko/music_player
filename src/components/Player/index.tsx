import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faDatabase } from "@fortawesome/free-solid-svg-icons";
import { goto } from "@/utils/url.ts";
import DataUI from "./components/data/index.tsx";
import VolumeUI from "./components/volume/index.tsx";
import SleepUI from "./components/sleep/index.tsx";
import ControlUI from "./components/control/index.tsx";

export default function Player() {
    return (
        <div className="player h-[5%] w-[90%] bg-slate-700 text-white mt-5 rounded-xl flex justify-between items-center px-1.25 m-0 select-none">
            <DataUI />

            <div className="flex flex-col items-center">
                <ControlUI />
            </div>
            <div className="volume group flex flex-row mr-2.5 cursor-pointer select-none">
                <SleepUI />

                <span
                    className="mr-2.5"
                    onClick={() => {
                        goto("/queue/play");
                    }}
                >
                    <FontAwesomeIcon icon={faDatabase} />
                </span>
                <VolumeUI />
            </div>
        </div>
    );
}
