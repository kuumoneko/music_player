import localstorage from "@/utils/localStorage.ts";
import { goto } from "@/utils/url.ts";
import { faSun, faMoon, faGear } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useState } from "react";

export default function Settings() {
    const [theme, setTheme] = useState(localstorage("get", "theme", "dark"));
    useEffect(() => {
        if (theme === "dark") {
            document.documentElement.setAttribute("data-theme", "dark");
            localstorage("set", "theme", "dark");
        } else {
            document.documentElement.setAttribute("data-theme", "light");
            localstorage("set", "theme", "light");
        }
    }, [theme]);
    return (
        <div className="header-icons flex top-5 right-5 gap-[15px] items-center cursor-pointer">
            <span className="user-mode h-1/2">
                <div className="flex justify-center items-center space-x-4">
                    <label className="relative inline-block w-[60px] h-8">
                        <input
                            type="checkbox"
                            className="opacity-0 w-0 h-0 peer"
                            checked={theme === "light"}
                            onChange={() =>
                                setTheme(theme === "dark" ? "light" : "dark")
                            }
                        />
                        <span className="slider round absolute cursor-pointer top-0 left-0 right-0 bottom-0 bg-gray-300 transition-all duration-400 rounded-[34px] before:absolute before:content-[''] before:h-6 before:w-6 before:left-1 before:bottom-1 before:bg-white before:transition-all before:duration-400 before:rounded-full peer-checked:bg-blue-500 peer-focus:ring-2 peer-focus:ring-blue-500 peer-checked:before:translate-x-6 flex items-center justify-between px-2">
                            <span>
                                <FontAwesomeIcon icon={faSun} />
                            </span>
                            <span>
                                <FontAwesomeIcon icon={faMoon} />
                            </span>
                        </span>
                    </label>
                </div>
            </span>
            <span className="settings" onClick={() => goto("/settings")}>
                <FontAwesomeIcon icon={faGear} />
            </span>
        </div>
    );
}
