// @ts-nocheck
// react server
import React, { useEffect, useState } from 'react';
import "./index.css"
// function
import { goto } from "./common/utils/url.ts"

import MainContent from './pages/index.tsx';
import Nav from './common/components/Navigator/index.tsx';
import { running } from '../prerun.tsx';
import { Data, fetch_data, get } from './common/utils/fetch.ts';


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

            const data = await fetch_data(Data.user);


            if (!data.youtube) {
                await fetch_data(Data.logout, { where: "youtube" });
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
                await fetch_data(Data.logout, { where: "spotify" });

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
