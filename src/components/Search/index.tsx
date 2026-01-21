import { goto } from "@/utils/url.ts";
import convert_link from "@/utils/link.ts";
import { useEffect, useState } from "react";
import localstorage from "@/utils/localStorage";

export default function SearchBar() {
    const [isAuth, setAuth] = useState(false);

    const [typing, settyping] = useState("");
    const [source, setsource] = useState<"" | "youtube" | "spotify">("");
    const [type, settype] = useState<"video" | "artist" | "playlist" | "">("");

    useEffect(() => {
        if (window.location.href.includes("auth")) {
            setAuth(true);
        }
        const run = setInterval(() => {
            const url = localstorage("get", "search", "");
            if (url === "") {
                settyping("");
            }
        }, 100);
        return () => {
            clearInterval(run);
        };
    }, []);

    const search = () => {
        if (typing === "") {
            return;
        }
        if (source === "") {
            return goto(`/${typing.split(":").join("/")}`);
        }
        return goto(`/search/${source.toLocaleLowerCase()}/${type}/${typing}`);
    };

    if (isAuth) {
        return <></>;
    }

    return (
        <div
            className="flex h-[5%] pt-1.25 mb-2.5 w-full flex-row items-center justify-center"
            onKeyDown={(e) => {
                if (e.key === "Enter") {
                    search();
                }
            }}
        >
            <div className="w-full max-w-175 flex">
                <input
                    type="text"
                    className="grow px-5 py-3 rounded-l-full bg-slate-200 text-slate-700 text-base outline-none shadow-inner min-h-7.5"
                    placeholder="Search here"
                    value={typing}
                    onChange={(e) => {
                        e.preventDefault();
                        settyping(e.target.value);
                        if (e.target.value === "") {
                            setsource("");
                            settype("");
                            return;
                        }
                        const {
                            source: sourcee,
                            id,
                            mode,
                        } = convert_link(e.target.value);
                        if (
                            sourcee === undefined ||
                            mode === undefined ||
                            id === undefined
                        ) {
                            if (source === "") {
                                setsource("youtube");
                            }

                            if (type === "") {
                                settype("video");
                            }
                        } else {
                            setsource("");
                            settype("");
                            localstorage(
                                "set",
                                "search",
                                `${mode}:${sourcee}:${id}`,
                            );
                            settyping(`${mode}:${sourcee}:${id}`);
                        }
                    }}
                />
                {source !== "" && (
                    <div
                        className="px-5 py-2 bg-slate-200 ml-1 text-slate-700 text-lg cursor-pointer flex items-center justify-center min-h-7.5 w-25"
                        onClick={() => {
                            setsource(
                                source === "youtube" ? "spotify" : "youtube",
                            );
                        }}
                    >
                        <span className="mt-[5%] h-full">{`${source}`}</span>
                    </div>
                )}
                {type !== "" && (
                    <div
                        className="px-5 py-2 bg-slate-200 ml-1 text-slate-700 text-lg cursor-pointer flex items-center justify-center min-h-7.5 w-25"
                        onClick={() => {
                            settype(
                                type === "artist"
                                    ? "playlist"
                                    : type === "playlist"
                                      ? "video"
                                      : "artist",
                            );
                        }}
                    >
                        <span className="mt-[5%] h-full">{`${type}`}</span>
                    </div>
                )}
                <button
                    className="px-5 py-2 rounded-r-full bg-green-500 text-white text-lg cursor-pointer flex items-center justify-center transition duration-200 ease-in-out hover:bg-green-600 min-h-7.5"
                    onClick={() => {
                        search();
                    }}
                >
                    <span className="material-icons">search</span>
                </button>
            </div>
        </div>
    );
}
