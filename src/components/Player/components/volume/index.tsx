import { useState, useRef, useEffect, RefObject } from "react";
import Slider from "@/components/Player/common/Slider/index.tsx";
import localstorage from "@/utils/localStorage.ts";

export default function VolumeUI({
    audioRef,
}: {
    audioRef: RefObject<HTMLAudioElement>;
}) {
    const [volume, setvolume] = useState(localstorage("get", "volume", 50));
    const volumeSliderRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (volumeSliderRef.current) {
            const min = Number(volumeSliderRef.current.min);
            const max = Number(volumeSliderRef.current.max);
            const percent = ((volume - min) / (max - min)) * 100;
            volumeSliderRef.current.style.setProperty(
                "--value-percent",
                `${percent}%`
            );
            if (audioRef.current) {
                audioRef.current.volume = percent / 100;
            }
            localstorage("set", "volume", String(percent));
        }
    }, [volume]);

    return (
        <div className="volume group flex flex-col items-center mr-2.5 cursor-pointer select-none">
            <Slider
                name={"volume"}
                width={"100"}
                reff={volumeSliderRef as RefObject<HTMLInputElement>}
                value={volume}
                Change={(e) => {
                    const newVolume = Number(e.target.value);
                    localstorage("set", "volume", String(newVolume));

                    setvolume(newVolume);
                }}
                max={100}
            />
            <span className="cursor-default">Volume: {volume}</span>
        </div>
    );
}
