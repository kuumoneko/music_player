import { useEffect, useState } from "react";
import { Show, Showw } from "../music";
import { get } from "../../../../../../dist/function/fetch.ts";
// import { get } from "../../../../../../dist/function/url";

export default function Local({ url }: { url: string }) {

    // const source = url.split("/").slice(3)[1];
    const check = JSON.parse(localStorage.getItem("localfile") as string);
    const [localfile, setlocalfile] = useState(check ? check : []);
    useEffect(() => {
        async function run() {
            const data = await get("/local");

            // const res = await fetch(`http://localhost:3001/local`, {
            //     method: "GET",
            //     headers: {
            //         "Content-Type": "application/json"
            //     }
            // })
            // if (res.status !== 200) {
            //     return;
            // }
            // const data = await res.json();
            // console.log(data);
            // (data.tracks);
            // localStorage.setItem("localfile", JSON.stringify(
            //     data.tracks
            // ))
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
