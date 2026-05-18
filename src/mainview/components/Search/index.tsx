import { goto } from "@/mainview/utils/url.ts";
import convert_link from "@/mainview/utils/link.ts";
import { useEffect, useState } from "react";
import localstorage from "@/mainview/utils/localStorage";

export default function SearchBar() {
    const [isAuth, setAuth] = useState(false);

    const [typing, settyping] = useState("");
    const [type, settype] = useState<"video" | "artist" | "playlist" | "">("");

    useEffect(() => {
        if (window.location.href.includes("auth")) {
            setAuth(true);
        }
        const onSearchChange = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (detail === "") {
                settyping("");
                settype("");
            }
        };
        window.addEventListener("searchchange", onSearchChange);
        return () => window.removeEventListener("searchchange", onSearchChange);
    }, []);

    const search = () => {
        if (typing === "") {
            return;
        }
        const [tempType, tempSource, tempId] = typing.split(":");
        if (tempId && tempSource && tempType) {
            return goto(`/${tempType}/${tempSource}/${tempId}`);
        }
        return goto(`/search/youtube/${type}/${typing}`);
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
                    className="grow px-5 py-3 rounded-l-full bg-zinc-200 text-zinc-700 text-base outline-none shadow-inner min-h-7.5"
                    placeholder="Search here"
                    value={typing}
                    onChange={(e) => {
                        e.preventDefault();
                        settyping(e.target.value);
                        const letters = e.target.value;
                        if (letters === "") {
                            settype("");
                            return;
                        }
                        if (
                            letters.includes(":") &&
                            letters.split(":").length === 3
                        ) {
                            return;
                        }
                        const {
                            source: sourcee,
                            id,
                            mode,
                        } = convert_link(letters);
                        if (
                            sourcee !== undefined &&
                            mode !== undefined &&
                            id !== undefined
                        ) {
                            settype("");
                            localstorage(
                                "set",
                                "search",
                                `${mode}:${sourcee}:${id}`,
                            );
                            settyping(`${mode}:${sourcee}:${id}`);
                        } else {
                            if (type === "") {
                                settype("video");
                            }
                            localstorage("set", "search", letters);
                            settyping(letters);
                        }
                    }}
                />
                {type !== "" && (
                    <div
                        className="px-5 py-2 bg-zinc-200 ml-1 text-zinc-700 text-lg cursor-pointer flex items-center justify-center min-h-7.5 w-25"
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
