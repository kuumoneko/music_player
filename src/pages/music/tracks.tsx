import List from "@/components/Show/components/list.tsx";
import Top from "@/components/Show/components/top.tsx";
import fetch from "@/utils/fetch.ts";
import localstorage from "@/utils/localStorage.ts";
import { useEffect, useState } from "react";

export default function Tracks() {
    const [dom, setdom] = useState(<></>);
    const run = async () => {
        const [source, id] = localstorage("get", "url", "/")
            .split("/")
            .slice(2);
        const result = await fetch(`/music/${source}/tracks/${id}`, "GET");

        setdom(
            <>
                <Top
                    name={result[0].name}
                    thumbnail={result[0].thumbnail}
                    duration={result[0].duration}
                    source={source}
                    id={id}
                    mode="track"
                    playlist={result}
                />
                <List list={result} source={source} id={id} mode="track" />
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
