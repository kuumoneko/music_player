import { useEffect, useState } from "react";
import { Data, fetch_data } from "../../../../common/utils/fetch.ts";
import Top from "../../../../common/components/Show_music/components/top.tsx";
import List from "../../../../common/components/Show_music/components/list.tsx";
import Loading from "../../../../common/components/Loading/index.tsx";

export default function Track({ url }: { url: string }) {

    const [dom, setdom] = useState(<Loading mode="Loading track" />);

    const refresh = async (source: string, id: string) => {
        const dataa = await fetch_data(Data.track, { where: source, id: id })
        setdom(
            <>
                <Top name={dataa?.track.name} thumbnail={dataa?.thumbnail} duration={dataa?.track.duration} releaseDate={dataa?.track.releaseDate} artists={dataa?.artists} source={source} id={id} mode={"track"} />
                <List list={dataa !== null ? [
                    {
                        thumbnail: dataa?.thumbnail,
                        track: dataa?.track,
                        artists: dataa?.artists,
                        name: dataa?.track.name,
                        duration: dataa?.track.duration,
                        releaseDate: dataa?.track.releaseDate
                    }
                ] : []} source={source} id={id} mode="track" />
            </>
        )
    }

    useEffect(() => {
        const [source, id] = url.split("/").slice(4);
        refresh(source, id)
    }, [url])
    return dom
}