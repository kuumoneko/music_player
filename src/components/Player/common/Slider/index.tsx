import { RefObject } from "react";

export default function Slider({ name, width, reff, value, Change, max }: { name: string, width: number | string, reff: RefObject<HTMLInputElement>, value: number, Change: (e: React.ChangeEvent<HTMLInputElement>) => void, max: number }) {
    return (
        <input
            title={name}
            ref={reff}
            type="range"
            min="0"
            max={max}
            value={value ?? 0}
            style={{
                width: `${width}px`,
            }}
            className={`${name} 
                        w-[${width}px] h-[5px]
                        cursor-pointer 
                        apperance-none
                        bg-transparent 
                        
                        /* Track: We use a gradient to create the 'filled' effect. */
                        /* The '--value-percent' CSS variable is set by the useEffect hook. */
                        [&::-webkit-slider-runnable-track]:h-1 
                        [&::-webkit-slider-runnable-track]:rounded-full 
                        [&::-webkit-slider-runnable-track]:bg-[linear-gradient(to_right,var(--color-red-500)_var(--value-percent),var(--color-slate-400)_var(--value-percent))]

                        /* Thumb: Webkit */
                        [&::-webkit-slider-thumb]:appearance-none 
                        [&::-webkit-slider-thumb]:h-4 
                        [&::-webkit-slider-thumb]:w-4 
                        [&::-webkit-slider-thumb]:rounded-full 
                        [&::-webkit-slider-thumb]:bg-red-500 
                        /* Vertically center thumb on track */  
                        [&::-webkit-slider-thumb]:-mt-1.5 
                        [&::-webkit-slider-thumb]:opacity-0
                        [&::-webkit-slider-thumb]:transition-opacity
                        hover:[&::-webkit-slider-thumb]:opacity-100
                        `}
            onChange={(e) => {
                Change(e);
            }}
        />
    )
}