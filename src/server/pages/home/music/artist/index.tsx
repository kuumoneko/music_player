import { useEffect, useState } from "react"
import { Data, fetch_data } from '../../../../common/utils/fetch';
import Loading from "../../../../common/components/Loading/index.tsx";
import Top from "../../../../common/components/Show_music/components/top.tsx";
import List from "../../../../common/components/Show_music/components/list.tsx";

export default function Artist({ url }: { url: string }) {
    const [dom, setdom] = useState(<Loading mode="Loading artist" />);

    const refresh = async (source: string, id: string) => {
        const artist: any = await fetch_data(Data.artist, { where: source, id: id });
        const tracks = artist.tracks.slice(0, 200) || [];
        const temp = (
            <>
                <Top name={artist.name} thumbnail={artist.thumbnail} duration={0} source={source} id={id} mode={"artist"} playlist={tracks} />
                <List list={tracks} source={source} id={id} mode="artist" />
            </>
        )
        setdom(temp)
    }

    useEffect(() => {
        const [source, id] = url.split("/").slice(4);
        console.log(source, ' ', id)
        refresh(source, id)
    }, [url])

    return dom
}