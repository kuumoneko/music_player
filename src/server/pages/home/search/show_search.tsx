import { useEffect, useState } from "react";
import { Data, fetch_data } from "../../../common/utils/fetch.ts";
import List from "../../../common/components/Show_music/components/list.tsx";

export default function Show_search({ urll }: { urll: String }) {
    const url = urll.split("/").slice(3);

    const [search, setsearch] = useState(JSON.parse(localStorage.getItem("search") as string).result.tracks || []);

    useEffect(() => {
        async function run() {
            const search = JSON.parse(localStorage.getItem("search") as string);
            if (search.query === url[2] && search.source === url[1]) {
                setsearch(search.result);
                return;
            }
            const data = await fetch_data(Data.search, { where: url[1], query: url[2] })
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
        <List list={search} source={url[2]} id="" mode="search" />
    )
}