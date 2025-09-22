import { useEffect, useState } from "react";
import { Data, fetch_data } from "../../../../utils/fetch.ts";
import Top from "../../../../components/Show_music/components/top.tsx";
import List from "../../../../components/Show_music/components/list.tsx";

export default function Local() {

    const check = JSON.parse(localStorage.getItem("localfile") as string);
    const [localfile, setlocalfile] = useState(check ? check : []);
    const [duration, setduration] = useState(0)
    useEffect(() => {
        async function run() {
            const data = await fetch_data(Data.local);
            setlocalfile(data.tracks);
            setduration(data.duration as number)
        }
        run();
    }, [])
    return (
        <>
            <Top name="local file" thumbnail={null} duration={duration} releaseDate="" artists={[]} source="local" id="" mode="playlist" playlist={localfile} />
            <List list={localfile} source="local" id="local" mode="local" />
        </>

    )
}
