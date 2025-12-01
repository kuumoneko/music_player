import Music from "@/components/Music/index.tsx";
import localstorage from "@/utils/localStorage.ts";

import { useEffect, useState } from "react";

export default function Albums() {
    const [dom, setdom] = useState(<></>);
    const [data, setdata] = useState({
        source: "",
        id: "",
    });

    const run = async () => {
        const [source, id] = localstorage("get", "url", "/")
            .split("/")
            .slice(2);
        if (source !== data.source || id !== data.id) {
            setdata({
                source,
                id,
            });
            setdom(<Music source={source} type="albums" id={id} />);
        }
    };

    useEffect(() => {
        run();
        const running = setInterval(() => {
            run();
        }, 1000);
        return () => clearInterval(running);
    }, []);

    return <>{dom}</>;
}
