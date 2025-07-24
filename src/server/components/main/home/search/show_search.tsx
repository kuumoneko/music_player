import { useEffect, useState } from "react";
import { Show } from "../music/music";
import { get } from "../../../../../dist/function/fetch";

export default function Show_search({ urll }: { urll: String }) {
    // get url
    const url = urll.split("/").slice(3);
    // console.log(url);

    const [search, setsearch] = useState(JSON.parse(localStorage.getItem("search") as string).result.tracks || []);

    useEffect(() => {
        async function run() {
            const search = JSON.parse(localStorage.getItem("search") as string);
            if (search.query === url[2] && search.source === url[1]) {
                setsearch(search.result);
                return;
            }
            const data = await get(`/search/${url[1]}/${url[2]}`);

            // const res = await fetch(`http://localhost:3001/search/${url[1]}/${url[2]}`, {
            //     method: "GET",
            //     headers: {
            //         'Content-Type': 'application/json',
            //     }
            // })

            // const data = await res.json();
            localStorage.setItem("search", JSON.stringify({
                query: url[1],
                source: url[2],
                result: data
            }));
            setsearch(data.tracks);
        }
        run();
    }, [])

    return (
        <Show list={search} source={url[2]} id="" mode="search" />
    )
}