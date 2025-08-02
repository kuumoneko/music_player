import { useEffect, useState } from "react";
import { Show } from "../music/music";
import { Data, fetch_data } from "../../../common/utils/fetch.ts";

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
            const data = await fetch_data(Data.search, { where: url[1], query: url[2] })
            // const data = await get(`/search/${url[1]}/${url[2]}`);
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