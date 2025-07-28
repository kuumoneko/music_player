import { useState } from "react";
import { goto } from "../../../common/utils/url.ts";
import convert_link from '../../../common/utils/convertlink.ts';

export default function Search({
    url,
    seturl
}: {
    url: string,
    seturl: (a: string) => void
}) {
    const [typing, settyping] = useState("");
    // Youtube , Spotify , ""
    const [source, setsource] = useState("");

    const search = () => {
        if (typing === "") return;
        if (source === "") {
            return goto(`/${typing.split(":").join("/")}`, seturl)
        }
        return goto(`/search/${typing}/${source.toLocaleLowerCase()}`, seturl)
    }

    return (
        <div className="flex h-[5%] pt-[5px] mb-[10px] w-full max-w-lg" onKeyDown={(e) => {
            if (e.key === "Enter") {
                search();
            }
        }}>
            <input
                type="text"
                className="flex-grow px-5 py-3 rounded-l-full bg-slate-700 dark:bg-slate-200 text-slate-200 dark:text-slate-700 text-base outline-none shadow-inner min-h-[30px]"
                placeholder="Search here"
                value={typing}
                onChange={(e) => {
                    settyping(e.target.value);
                    const link = convert_link(e.target.value)
                    if (link.source !== "spotify" && link.source !== "youtube") {
                        setsource(link.source === "youtube" ? "Youtube" : "Spotify");
                    }
                    else {
                        setsource("");
                        const { source, id, mode } = link;
                        settyping(`${mode}:${source}:${id}`)
                    }
                }}
            />
            {
                source !== "" && (
                    <div className="flex min-h-[30px] h-[100%] flex-col">
                        <div className="bg-slate-700 dark:bg-slate-200 text-slate-200 dark:text-slate-700 m-0 w-[100px] flex items-center justify-center select-none h-[100%] min-h-[30px] cursor-pointer ml-[1px]"
                            onClick={() => {
                                setsource(source === "Youtube" ? "Spotify" : "Youtube");
                            }}
                        >
                            <span className="mt-[5%]">
                                {`${source}`}
                            </span>
                        </div>
                    </div>
                )
            }
            <button className="px-5 py-2 rounded-r-full bg-green-500 text-white text-lg cursor-pointer flex items-center justify-center transition duration-200 ease-in-out hover:bg-green-600 min-h-[30px]" onClick={() => {
                search();
            }}>
                <span className="material-icons">search</span>
            </button>
        </div>
    )
}