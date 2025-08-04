import { useState, useRef, useEffect } from "react";
import Slider from "../../common/Slider/index.tsx";

export default function VolumeUI() {
    const [volume, setvolume] = useState(() => Number(localStorage.getItem("volume") || 50));
    const volumeSliderRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (volumeSliderRef.current) {
            const min = Number(volumeSliderRef.current.min);
            const max = Number(volumeSliderRef.current.max);
            const percent = ((volume - min) / (max - min)) * 100;
            volumeSliderRef.current.style.setProperty('--value-percent', `${percent}%`);
            localStorage.setItem("volume", String(percent))
        }
    }, [volume]);

    return (
        <div className='volume group flex flex-col items-center mr-[10px] cursor-pointer select-none'>
            <Slider name={"volume"} width={"100"} reff={volumeSliderRef} value={volume} Change={(e) => {
                const newVolume = Number(e.target.value);
                localStorage.setItem("volume", String(newVolume));
                setvolume(newVolume);
            }} max={100} />
            <span className='cursor-default'>
                Volume: {volume}
            </span>
        </div>
    )
}