import { useEffect, useState } from "react";
import { Show, Showw } from "../music";
import { Data, fetch_data } from "../../../../common/utils/fetch.ts";

export default function Local() {

    const check = JSON.parse(localStorage.getItem("localfile") as string);
    const [localfile, setlocalfile] = useState(check ? check : []);
    useEffect(() => {
        async function run() {
            const data = await fetch_data(Data.local);
            setlocalfile(data.tracks);
        }
        run();
    }, [])

    return (
        <>
            <Showw name="local file" thumbnail={null} duration={0} releaseDate="" artists={[]} source="local" id="" mode="playlist" playlist={localfile} />
            <Show list={localfile} source="local" id="local" mode="local" />
        </>

    )
}
