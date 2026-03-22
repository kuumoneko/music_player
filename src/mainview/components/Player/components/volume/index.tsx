import { useState, useRef, useEffect, RefObject } from "react";
import Slider from "@/mainview/components/Player/common/Slider";

export default function VolumeUI() {
    const [volume, setvolume] = useState(50);
    const volumeSliderRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        window.api.rpc.request.getUserData("volume").then((data) => {
            setvolume(data);
        });
    }, []);

    useEffect(() => {
        if (volumeSliderRef.current) {
            const min = Number(volumeSliderRef.current.min);
            const max = Number(volumeSliderRef.current.max);
            const percent = ((volume - min) / (max - min)) * 100;
            volumeSliderRef.current.style.setProperty(
                "--value-percent",
                `${percent}%`,
            );
            window.api.rpc.request.setUserData({
                key: "volume",
                data: volume,
            });
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
                    setvolume(newVolume);
                }}
                max={100}
            />
            <span className="cursor-default">Volume: {volume}</span>
        </div>
    );
}
