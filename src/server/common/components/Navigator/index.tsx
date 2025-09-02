import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faArrowLeft,
    faArrowRight,
    faArrowsRotate,
    faDownload,
    faHome,
    faList,
} from "@fortawesome/free-solid-svg-icons";
import SettingsModal from "./settings/index.tsx";
import Themes from "./settings/other/theme.tsx";
import { Force, goto } from "../../utils/url.ts";

export default function Nav({
    url,
    seturl,
}: {
    url: string;
    seturl: (a: string) => void;
}) {
    // New state for preferred audio format (only one can be selected)
    // const [preferredAudioFormat, setPreferredAudioFormat] = useState(() => {
    //     const saved = localStorage.getItem('preferredAudioFormat');
    //     return saved ? saved : 'mp3';
    // });

    // theme (dark or light mode)
    const [theme, settheme] = useState(() => {
        const savedTheme = localStorage.getItem("theme");
        if (savedTheme) {
            return savedTheme;
        }
        return window.matchMedia?.("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light";
    });

    useEffect(() => {
        document.body.className = theme;
        const body = document.body;
        // add dark into className of all element when theme is dark and remove it when theme is light
        if (theme === "dark") {
            body.classList.add("dark");
        } else {
            body.classList.remove("dark");
        }
        localStorage.setItem("theme", theme);
    }, [theme]);

    const [backward, setbackward] = useState(
        localStorage.getItem("backward") || "[]"
    );
    const [forward, setforward] = useState(
        localStorage.getItem("forward") || "[]"
    );

    const [ishome, setishome] = useState(
        localStorage.getItem("url")?.split("/")[3] === ""
    );

    useEffect(() => {
        const run = setInterval(() => {
            setbackward((localStorage.getItem("backward") as string) || "[]");
            setforward((localStorage.getItem("forward") as string) || "[]");
            setishome(localStorage.getItem("url")?.split("/")[3] === "");
        }, 100);
        return () => clearInterval(run);
    }, []);

    return (
        <div className="nav bg-slate-200 dark:bg-slate-700 h-[50px] w-[90%] flex justify-between items-center rounded-full p-6 mt-[10px]">
            <div className="home-icon flex flex-row items-center gap-[10px]">
                <span
                    className={`material-icons flex items-center gap-[5px] text-black dark:text-white cursor-default select-none ${
                        JSON.parse(backward).length === 0
                            ? "opacity-50 pointer-events-none"
                            : ""
                    }`}
                    onClick={() => {
                        const backw: string[] =
                            JSON.parse(
                                localStorage.getItem("backward") as string
                            ) || [];
                        const temp = backw.pop() || "/";
                        goto(temp, seturl, Force.backward);
                    }}
                >
                    <FontAwesomeIcon icon={faArrowLeft} />
                </span>
                <span
                    className={`material-icons flex items-center gap-[5px] text-black dark:text-white cursor-default select-none`}
                    onClick={() => {
                        window.location.reload();
                    }}
                >
                    <FontAwesomeIcon icon={faArrowsRotate} />
                </span>
                <span
                    className={`material-icons flex items-center gap-[5px] text-black dark:text-white cursor-default select-none ${
                        JSON.parse(forward).length === 0
                            ? "opacity-50 pointer-events-none"
                            : ""
                    }`}
                    onClick={() => {
                        const forw: string[] =
                            JSON.parse(
                                localStorage.getItem("forward") as string
                            ) || [];
                        const temp = forw.shift() || "/";
                        goto(temp, seturl, Force.forward);
                    }}
                >
                    <FontAwesomeIcon icon={faArrowRight} />
                </span>
                <span
                    className={`material-icons flex items-center gap-[5px] text-black dark:text-white cursor-default select-none ${
                        ishome ? "opacity-50 pointer-events-none" : ""
                    }`}
                    onClick={() => {
                        goto("/", seturl);
                    }}
                >
                    <FontAwesomeIcon icon={faHome} />
                </span>
                <span
                    className="material-icons flex items-center gap-[5px] text-black dark:text-white cursor-default select-none"
                    onClick={() => {
                        goto("/queue/play", seturl);
                    }}
                >
                    <FontAwesomeIcon icon={faList} />
                </span>
                <span
                    className="material-icons flex items-center gap-[5px] text-black dark:text-white cursor-default select-none"
                    onClick={() => {
                        goto("/queue/download", seturl);
                    }}
                >
                    <FontAwesomeIcon icon={faDownload} />
                </span>
            </div>

            <div className="title">
                <span className="cursor-auto select-none text-black dark:text-white">
                    Music web app
                </span>
            </div>

            <div className="settings">
                <Themes theme={theme} settheme={settheme} seturl={seturl} />

                <SettingsModal
                    url={url}
                    seturl={seturl}
                    isOpen={url.split("/")[1] === "settings"}
                />
            </div>
        </div>
    );
}
