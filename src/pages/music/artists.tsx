import List from "@/components/Show/components/list.tsx";
import Top from "@/components/Show/components/top.tsx";
import fetch_data from "@/utils/fetch.ts";
import localstorage from "@/utils/localStorage.ts";
import { useEffect, useState } from "react";

export default function Artists() {
    const [dom, setdom] = useState(<></>);
    const run = async () => {
        const [source, id] = localstorage("get", "url", "/")
            .split("/")
            .slice(2);
        const result = await fetch_data(
            `/music/${source}/artists/${id}`,
            "GET"
        );
        setdom(
            <>
                <Top
                    name={result.name}
                    thumbnail={result.thumbnail}
                    duration={0}
                    source={source}
                    id={id}
                    mode="artist"
                    playlist={result.tracks ?? []}
                />
                <List
                    list={result.tracks ?? []}
                    source={source}
                    id={id}
                    mode="artist"
                />
            </>
        );
    };

    useEffect(() => {
        run();
        const running = setInterval(() => {
            run();
        }, 15000);
        return () => clearInterval(running);
    }, []);

    return <>{dom}</>;
}
