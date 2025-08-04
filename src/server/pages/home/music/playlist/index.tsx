import { useEffect, useState } from "react";
import { Show, Showw } from "../music";
import { Data, fetch_data } from "../../../../common/utils/fetch.ts";

export default function Playlist({ urll }: { urll: string }) {
    const tempping = urll.split("/").slice(3)
    // const [source, setsource] = useState(urll.split("/").slice(3)[1]);
    // const [id, setid] = useState(urll.split("/").slice(3)[2]);
    const [data, setdata] = useState(tempping[1] + "/" + tempping[2])

    const [playlist, setPlaylist] = useState([]);
    const [thumbnail, setthumbnail] = useState<any>(null);
    const [name, setname] = useState<any>(null);
    const [duration, setduration] = useState<any>(null);

    useEffect(() => {
        const run = window.setInterval(() => {
            const lmao = localStorage.getItem("url") as string;
            const temp = lmao.split("/").slice(3)
            setdata(temp[1] + "/" + temp[2])

        }, 100);
        return () => window.clearInterval(run);
    })

    useEffect(() => {
        async function run() {
            const [source, id] = data.split("/")
            const dataa = await fetch_data(Data.playlist, { where: source, id: id })
            setthumbnail(dataa.thumbnail);
            setname(dataa.name);
            setduration(dataa.duration);
            setPlaylist(dataa.tracks);
        }

        run();
    }, [data])

    return (
        <>
            <Showw name={name} thumbnail={thumbnail} duration={duration} source={data.split("/")[0]} id={data.split("/")[1]} mode={"playlist"} playlist={playlist} />
            <Show list={playlist} source={data.split("/")[0]} id={data.split("/")[1]} mode="playlist" />
        </>

    )

}