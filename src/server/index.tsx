// @ts-nocheck
// react server
import React, { useEffect, useState } from 'react';
// import "./index.css";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDownload, faGear, faMoon, faSun } from '@fortawesome/free-solid-svg-icons';

// function
import SettingsModal from '../server/settings/index.tsx';
import Themes from '../server/settings/theme.tsx';
import Search from '../dist/search.tsx';
import Show_links from '../dist/show_links.tsx';
import Download from '../dist/download.tsx';
import addLink from '../function/addlink.ts';
import setTheme from '../function/settheme.ts';
import giveerror from '../function/giveerror.ts';
import toggleTheme from '../function/toggletheme.ts';
import { Link } from '../types/index.ts';
import { goto } from "../dist/function/url.ts"

import Sidebar from './components/main/sidebar/index.tsx';
import MainContent from './components/main/index.tsx';
import Player from './components/main/player/index.tsx';
import Nav from './components/navigator/index.tsx';
import Footer from './components/footer/index.tsx';
import { running } from '../prerun.tsx';
import { get } from '../dist/function/fetch.ts';


export default function Server() {
    const port = Number(localStorage.getItem("port") as string)
    const [url, seturl] = useState(localStorage.getItem("url") || `http://localhost:${port}/`);

    // console.log(url)
    const general_url = window.location.href;

    if (general_url.includes("youtube.readonly") && general_url.includes("code=")) {
        // console.log(`http://localhost:3000/settings/youtube/${general_url.split("&code=")[1].split("&scope=")[0]}`)
        goto(`/settings/youtube/${general_url.split("&code=")[1].split("&scope=")[0]}`, seturl)
        window.location.href = "/"
    }
    else if (general_url.includes("?code")) {
        goto(`/settings/spotify/${general_url.split(`localhost:${port}/`)[1].split("?")[1].split("=")[1].split("&")[0]}`, seturl)
        window.location.href = "/"
    }

    useEffect(() => {
        async function run() {
            const data = await get("/user");
            // const res = await fetch("http://localhost:3001/user", {
            //     method: "GET"
            // });

            // const data = await res.json();


            if (!data.youtube) {
                get("/logout/youtube");

                // await fetch("http://localhost:3001/logout/youtube", { method: "GET" })
                localStorage.setItem("user", JSON.stringify({
                    spotify: JSON.parse(localStorage.getItem("user") as string).spotify,
                    youtube: {
                        user: {
                            name: "",
                            thumbnail: ""
                        }
                    },
                }));
            } else {
                localStorage.setItem("user", JSON.stringify({
                    spotify: JSON.parse(localStorage.getItem("user") as string).spotify,
                    youtube: {
                        user: {
                            name: data.youtube.name,
                            thumbnail: data.youtube.thumbnail
                        }
                    },
                }));
            }

            if (!data.spotify) {
                get("/logout/spotify");

                // await fetch("http://localhost:3001/logout/youtube", { method: "GET" })

                localStorage.setItem("user", JSON.stringify({
                    youtube: JSON.parse(localStorage.getItem("user") as string).youtube,
                    spotify: {
                        user: {
                            name: "",
                            email: "",
                            id: "",
                        },
                    }
                }));
            }
            else {
                localStorage.setItem("user", JSON.stringify({
                    youtube: JSON.parse(localStorage.getItem("user") as string).youtube,
                    spotify: {
                        user: {
                            name: data.spotify.display_name,
                            email: data.spotify.email,
                            id: data.spotify.id,
                        },
                    }
                }));
            }
        }
        run();
    }, [])


    useEffect(() => {
        const run = window.setInterval(() => {
            running()
        }, 1000);
    }, [])

    return (
        <>
            <div className="app flex h-screen w-screen items-center justify-between flex-col overflow-hidden m-0 p-0 select-none cursor-default">
                <Nav url={url} seturl={seturl} />
                <MainContent url={url} seturl={seturl} />
            </div>
        </>
    );
}
