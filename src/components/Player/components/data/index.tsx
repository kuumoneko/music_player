import { useState, useEffect } from "react";
import { goto } from "@/utils/url.ts";
import localstorage from "@/utils/localStorage.ts";

export default function DataUI() {
    const [id, setid] = useState<any>("");
    const [name, setname] = useState<any>("");
    const [artists, setartists] = useState<any>("");
    const [thumbnail, setthumbnail] = useState<any>("");
    const [source, setsource] = useState<any>("");

    const update = () => {
        const data = localstorage("get", "playing", {});
        setname(data.name);
        setartists(data.artists);
        setthumbnail(data.thumbnail);
        setid(data.id);
        setsource(data.source);
    };

    useEffect(() => {
        update();
        const run = window.setInterval(() => {
            async function run() {
                update();
            }
            run();
        }, 100);
        return () => window.clearInterval(run);
    }, []);

    return (
        <div className="flex flex-row items-center ml-[15px]">
            <span>
                {thumbnail ? (
                    <img
                        src={thumbnail as string}
                        alt=""
                        height={50}
                        width={50}
                        className="rounded-lg"
                    />
                ) : (
                    <></>
                )}
            </span>
            <div className="currently-playing ml-[5px] cursor-default select-none flex flex-col">
                {id !== "" && (
                    <span
                        className="text-sm hover:underline hover:cursor-pointer"
                        onClick={() => {
                            goto(`/track/${source}/${id}`);
                        }}
                    >
                        {name?.slice(0, 30)}
                    </span>
                )}
                {artists !== "" && <span className="text-sm">{artists}</span>}
            </div>
        </div>
    );
}
