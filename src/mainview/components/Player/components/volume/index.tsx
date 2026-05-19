import { useRef, useEffect, RefObject } from "react";
import Slider from "@/mainview/components/Player/common/Slider";
import { usePlayerState } from "@/mainview/context/PlayerContext.tsx";

export default function VolumeUI() {
    const { volume } = usePlayerState();
    const volumeSliderRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (volumeSliderRef.current) {
            const min = Number(volumeSliderRef.current.min);
            const max = Number(volumeSliderRef.current.max);
            const percent = ((volume - min) / (max - min)) * 100;
            volumeSliderRef.current.style.setProperty("--value-percent", `${percent}%`);
        }
    }, [volume]);

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        window.api.rpc.request.setUserData({ key: "volume", data: Number(e.target.value) });
    };

    return (
        <div className="volume group flex flex-col items-center mr-2.5 cursor-pointer select-none">
            <Slider
                name={"volume"}
                reff={volumeSliderRef as RefObject<HTMLInputElement>}
                value={volume}
                Change={handleVolumeChange}
                max={100}
            />
            <span className="cursor-default">{volume}</span>
        </div>
    );
}
