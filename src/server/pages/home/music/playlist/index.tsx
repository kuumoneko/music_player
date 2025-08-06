import { useEffect, useState } from "react";
import { Show, Showw } from "../music";
import { Data, fetch_data } from "../../../../common/utils/fetch.ts";

export default function Playlist({ urll }: { urll: string }) {
    const tempping = urll.split("/").slice(3)
    const [data, setdata] = useState(tempping[1] + "/" + tempping[2])

    const [playlist, setPlaylist] = useState([]);
    const [thumbnail, setthumbnail] = useState<any>(null);
    const [name, setname] = useState<any>(null);
    const [duration, setduration] = useState<any>(null);

    const refesh = async (data_url: string) => {
        const [source, id] = data_url.split("/")
        const dataa = await fetch_data(Data.playlist, { where: source, id: id })
        setthumbnail(dataa.thumbnail);
        setname(dataa.name);
        setduration(dataa.duration);
        setPlaylist(dataa.tracks);
    }

    useEffect(() => {
        const run = window.setInterval(() => {
            const lmao = localStorage.getItem("url") as string;
            const temp = lmao.split("/").slice(3)
            const test = data;
            setdata(temp[1] + "/" + temp[2])
            if (test[0] !== temp[1] || test[1] !== temp[2]) {
                refesh(`${temp[1]}/${temp[2]}`)
                setdata(temp[1] + "/" + temp[2])
            }
        }, 500);
        return () => window.clearInterval(run);
    })

    useEffect(() => {
        refesh(data)
    }, [])

    return (
        <>
            <Showw name={name} thumbnail={thumbnail} duration={duration} source={data.split("/")[0]} id={data.split("/")[1]} mode={"playlist"} playlist={playlist} />
            <Show list={playlist} source={data.split("/")[0]} id={data.split("/")[1]} mode="playlist" />
        </>

    )

}