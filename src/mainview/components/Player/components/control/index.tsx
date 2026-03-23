import localstorage from "@/mainview/utils/localStorage";
import { Repeat, Shuffle } from "@/shared/types.ts";
import {
    faShuffle,
    faStepBackward,
    faPause,
    faPlay,
    faStepForward,
    faRepeat,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { RefObject, useEffect, useRef, useState } from "react";
import { formatDuration } from "@/mainview/utils/format";
import Slider from "../../common/Slider";

export default function ControlUI() {
    const [played, setplayed] = useState(false);
    const [shuffle, setshuffle] = useState(Shuffle.Disable);
    const [repeat, setrepeat] = useState(Repeat.Disable);
    const [isloading, setisloading] = useState(true);
    const [playedTrack, setPlayedTrack] = useState([]);
    const [playing, setPlaying] = useState({
        time: 0,
        duration: 0,
    });

    const update = () => {
        window.api.rpc.request.getUserData("current").then((data) => {
            setPlaying(data);
        });
        window.api.rpc.request.getUserData("shuffle").then((data) => {
            setshuffle(data);
        });
        window.api.rpc.request.getUserData("repeat").then((data) => {
            setrepeat(data);
        });
        window.api.rpc.request.getUserData("isPlaying").then((data) => {
            setplayed(data);
        });
        window.api.rpc.request.getUserData("isLoading").then((data) => {
            setisloading(data);
        });
        window.api.rpc.request.getUserData("playedTrack").then((data) => {
            setPlayedTrack(data.length > 0 ? [1] : []);
        });
    };

    useEffect(() => {
        update();
        const run = setInterval(() => {
            update();
        }, 500);
        return () => clearInterval(run);
    }, []);

    const TimeSliderRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (TimeSliderRef.current) {
            const min = Number(TimeSliderRef.current.min);
            const max = Number(TimeSliderRef.current.max);
            const percent =
                max > 0 ? ((playing.time - min) / (max - min)) * 100 : 0;
            TimeSliderRef.current.style.setProperty(
                "--value-percent",
                `${percent}%`,
            );
        }
    }, [playing.time]);

    const handleTimeSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newTime = Number(e.target.value);
        window.api.rpc.request.seekTo(newTime);
    };

    return (
        <div className="flex flex-col items-center w-full">
            <div
                className={`controls flex flex-row gap-2.5 ${isloading ? "opacity-50 pointer-events-none" : ""}`}
            >
                {/* Shuffle */}
                <button
                    className="mx-0.5 p-0.5 cursor-default select-none rounded-full px-1 py-0.5 hover:bg-slate-500 hover:cursor-pointer"
                    onClick={() => {
                        const new_shuffle =
                            shuffle === Shuffle.Disable
                                ? Shuffle.Enable
                                : Shuffle.Disable;
                        setshuffle(new_shuffle);
                        localstorage("set", "shuffle", new_shuffle);
                        window.api.rpc.request.setUserData({
                            key: "shuffle",
                            data: new_shuffle,
                        });
                    }}
                >
                    <FontAwesomeIcon
                        icon={faShuffle}
                        className={
                            shuffle === Shuffle.Disable ? "" : "text-red-500"
                        }
                    />
                </button>

                {/* Backward */}
                <button
                    className={`mx-0.5 p-0.5 cursor-default select-none rounded-full px-1 py-0.5 hover:bg-slate-500 hover:cursor-pointer ${playedTrack.length === 0 ? "opacity-50 pointer-events-none" : ""}`}
                    onClick={() => window.api.rpc.request.previous()}
                >
                    <FontAwesomeIcon icon={faStepBackward} />
                </button>

                {/* Play/Pause */}
                <button
                    className="mx-0.5 p-0.5 cursor-default select-none rounded-full px-1 py-0.5 hover:bg-slate-500 hover:cursor-pointer"
                    onClick={() => {
                        // setplayed(!played);
                        window.api.rpc.request.togglePlayPause();
                    }}
                >
                    <FontAwesomeIcon icon={played ? faPause : faPlay} />
                </button>

                {/* Forward */}
                <button
                    className="mx-0.5 p-0.5 cursor-default select-none rounded-full px-1 py-0.5 hover:bg-slate-500 hover:cursor-pointer"
                    onClick={async () => {
                        window.api.rpc.request.next();
                    }}
                >
                    <FontAwesomeIcon icon={faStepForward} />
                </button>

                {/* Repeat */}
                <button
                    className="relative mx-0.5 p-0.5 cursor-default select-none rounded-full px-1 py-0.5 hover:bg-slate-500 hover:cursor-pointer"
                    onClick={() => {
                        const new_repeat =
                            repeat === Repeat.Disable
                                ? Repeat.All
                                : repeat === Repeat.All
                                  ? Repeat.One
                                  : Repeat.Disable;
                        setrepeat(new_repeat);
                        window.api.rpc.request.setUserData({
                            key: "repeat",
                            data: new_repeat,
                        });
                        localstorage("set", "repeat", new_repeat);
                    }}
                >
                    <FontAwesomeIcon
                        icon={faRepeat}
                        className={
                            repeat === Repeat.All
                                ? "text-red-500"
                                : repeat === Repeat.One
                                  ? "text-green-500"
                                  : ""
                        }
                    />
                    {repeat === Repeat.One && (
                        <span className="absolute inset-0 flex items-center justify-center text-white text-[8px] font-bold pointer-events-none">
                            1
                        </span>
                    )}
                </button>
            </div>

            <div className="player flex flex-row items-center w-full">
                <span className="mr-1.25 cursor-default select-none text-xs min-w-24 w-1/6 text-center">
                    {playing.duration > 0
                        ? `${formatDuration(playing.time)} / ${formatDuration(playing.duration / 1000)}`
                        : `Loading`}
                </span>
                <Slider
                    name={"time"}
                    reff={TimeSliderRef as RefObject<HTMLInputElement>}
                    value={playing.time ?? 0}
                    Change={handleTimeSliderChange}
                    max={(playing.duration ?? 0) / 1000}
                />
            </div>
        </div>
    );
}
