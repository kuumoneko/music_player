import { useEffect, useState } from "react";
import { Show, Showw } from "../music/index.tsx";
import { get } from "../../../../../../dist/function/fetch.ts";
// import { get } from "../../../../../../dist/function/url.ts";

export default function Track({ urll }: { urll: string }) {
    const url = urll.split("/").slice(3);
    const source = url[1],
        id = url[2];

    const [track, settrack] = useState<any>(null);

    useEffect(() => {
        async function run() {
            const data = await get(`/track/${source}/${id}`)
            // const res = await fetch(`http://localhost:3001/track/${source}/${id}`, {
            //     method: "GET",
            //     headers: {
            //         "Content-Type": "application/json",
            //     }
            // })

            // if (res.status !== 200) {
            //     return;
            // }

            // const data = await res.json();

            settrack({
                thumbnail: data.thumbnail,
                track: data.track,
                artists: data.artists,
                name: data.track.name,
                duration: data.track.duration,
                releaseDate: data.track.releaseDate
            })
        }
        run();
    }, [])

    return (
        <>

            <Showw name={track?.track.name} thumbnail={track?.thumbnail} duration={track?.track.duration} releaseDate={track?.track.releaseDate} artists={track?.artists} source={source} id={url[2]} mode={"track"} />
            <Show list={track !== null ? [
                {
                    thumbnail: track?.thumbnail,
                    track: track?.track,
                    artists: track?.artists,
                    name: track?.track.name,
                    duration: track?.track.duration,
                    releaseDate: track?.track.releaseDate
                }
            ] : []} source={source} id={url[2]} mode="track" />
        </>
    )
}