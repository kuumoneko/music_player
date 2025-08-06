import { useEffect, useState } from "react"
import { Data, fetch_data } from '../../../../common/utils/fetch';
import { Show, Showw } from "../music/index.tsx";
import Loading from "../../../../common/components/Loading/index.tsx";

export default function Artist({ url }: { url: string }) {
    const tempping = url.split("/").slice(4)

    const [data, setdata] = useState(tempping[0] + "/" + tempping[1])

    const [playlist, setPlaylist] = useState([]);
    const [thumbnail, setthumbnail] = useState<any>(null);
    const [name, setname] = useState<any>(null);
    const [duration, setduration] = useState<any>(0);
    const [dom, setdom] = useState(<Loading mode="Loading" />)

    const refresh = async (dataa: string) => {
        const [source, id] = dataa.split("/");
        const artist: any = await fetch_data(Data.artist, { where: source, id: id })
        setPlaylist(artist.tracks);
        setname(artist.name);
        setthumbnail(artist.thumbnail);
        const temp = (
            <>
                <Showw name={artist.name} thumbnail={artist.thumbnail} duration={0} source={source} id={id} mode={"artist"} playlist={artist.tracks} />
                <Show list={artist.tracks} source={source} id={id} mode="artist" />
            </>
        )
        setdom(temp)
    }

    useEffect(() => {
        const run = window.setInterval(() => {
            const lmao = localStorage.getItem("url") as string;
            const [source, id] = lmao.split("/").slice(4)
            const temp = data;
            if (temp[0] !== source || temp[1] !== id) {
                setdata(`${source}/${id}`)
            }
        }, 500);
        return () => window.clearInterval(run);
    })

    useEffect(() => {
        refresh(data);
    }, [data])

    return (
        <>
            {
                dom
            }
        </>
    )
}