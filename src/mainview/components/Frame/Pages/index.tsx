import localstorage from "@/mainview/utils/localStorage.ts";
import { goto } from "@/mainview/utils/url.ts";
import { faBars, faUsers, faHome } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useState } from "react";

export default function ControlPages() {
    const [isAuth, setAuth] = useState(false);

    useEffect(() => {
        if (window.location.href.includes("auth")) {
            setAuth(true);
        }
    }, []);

    const [activeIndex, setActiveIndex] = useState(1);

    useEffect(() => {
        const run = setInterval(() => {
            const url = localstorage("get", "url", "/");
            if (url === "/") {
                setActiveIndex(1);
            } else if (url.includes("/playlists")) {
                setActiveIndex(0);
            } else if (url.includes("/artists")) {
                setActiveIndex(2);
            } else {
                setActiveIndex(-1);
            }
        }, 1);
        return () => clearInterval(run);
    }, []);

    const menuItems = [
        {
            text: "Playlists",
            icon: <FontAwesomeIcon icon={faBars} />,
            url: "playlists",
        },
        {
            text: "Home",
            icon: <FontAwesomeIcon icon={faHome} />,
            url: "",
        },
        {
            text: "Artists",
            icon: <FontAwesomeIcon icon={faUsers} />,
            url: "artists",
        },
    ];
    if (isAuth) {
        return <></>;
    }
    return (
        <div className="relative flex items-center justify-center w-3/5 min-w-100 h-full bg-zinc-700 rounded-lg">
            <ul className="flex w-52.5">
                {menuItems.map((item, index) => (
                    <li
                        key={item.text}
                        className="relative z-10 w-1/2 h-full list-none hover:cursor-pointer"
                        onClick={() => {
                            setActiveIndex(index);
                            if (
                                localstorage("get", "url", "/") ===
                                "/" + item.url
                            ) {
                                return;
                            }
                            goto("/" + item.url);
                        }}
                    >
                        <a className="relative flex flex-col items-center justify-center w-full text-center font-medium">
                            <span
                                className={`relative block text-2xl text-center transition-transform duration-500 hover:text-red-400 px-1 py-1 rounded-full
                            ${activeIndex === index ? "text-lime-400" : "text-white"}`}
                            >
                                {item.icon}
                            </span>
                        </a>
                    </li>
                ))}
            </ul>
        </div>
    );
}
