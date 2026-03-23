import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faDatabase } from "@fortawesome/free-solid-svg-icons";
import { goto } from "@/mainview/utils/url.ts";
import DataUI from "./components/data/index.tsx";
import VolumeUI from "./components/volume/index.tsx";
import SleepUI from "./components/sleep/index.tsx";
import ControlUI from "./components/control/index.tsx";

export default function Player() {
    return (
        <div className="player h-[5%] w-[90%] bg-slate-700 text-white mt-5 rounded-xl flex justify-between items-center px-1.25 m-0 select-none">
            <DataUI />

            <div className="flex flex-col items-center w-1/2">
                <ControlUI />
            </div>
            <div className="volume group flex flex-row mr-2.5 cursor-pointer select-none w-1/6">
                <SleepUI />

                <span
                    className="mr-2.5 rounded-full px-1 py-0.5 hover:bg-slate-500 hover:cursor-pointer"
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
