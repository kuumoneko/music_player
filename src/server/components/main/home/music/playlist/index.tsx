import { useEffect, useState } from "react";
import { Show, Showw } from "../music";
import { get } from "../../../../../../dist/function/fetch.ts";
// import { get } from "../../../../../../dist/function/url";

export default function Playlist({ urll }: { urll: string }) {
    const [source, setsource] = useState(urll.split("/").slice(3)[1]);
    const [id, setid] = useState(urll.split("/").slice(3)[2]);


    const [playlist, setPlaylist] = useState([]);
    const [thumbnail, setthumbnail] = useState<any>(null);
    const [name, setname] = useState<any>(null);
    const [duration, setduration] = useState<any>(null);

    useEffect(() => {
        const run = window.setInterval(() => {
            const lmao = localStorage.getItem("url") as string;

            setsource(lmao.split("/").slice(3)[1]);
            setid(lmao.split("/").slice(3)[2])

        }, 500);
        return () => window.clearInterval(run);
    })



    useEffect(() => {

        async function run() {
            const data = await get(`/playlist/${source}/${id}`);

            // const res = await fetch(`http://localhost:3001/playlist/${source}/${id}`, {
            //     method: "GET",

            //     headers: {
            //         "Content-Type": "application/json"
            //     }
            // })

            // if (res.status !== 200) {
            //     return;
            // }

            // const data = await res.json();
            

            setthumbnail(data.thumbnail);
            setname(data.name);
            setduration(data.duration);
            setPlaylist(data.tracks);
        }

        run();
    }, [source, id])

    return (
        <>
            <Showw name={name} thumbnail={thumbnail} duration={duration} source={source} id={id} mode={"playlist"} playlist={playlist} />
            <Show list={playlist} source={source} id={id} mode="playlist" />
        </>

    )

}