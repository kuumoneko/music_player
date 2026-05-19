import Music from "@/mainview/components/Music/index.tsx";
import localstorage from "@/mainview/utils/localStorage.ts";
import { useEffect, useState } from "react";

export default function Artists() {
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
            setdom(<Music source={source} type="artists" id={id} />);
        }
    };

    useEffect(() => {
        run();
        const onUrlChange = () => run();
        window.addEventListener("urlchange", onUrlChange);
        return () => window.removeEventListener("urlchange", onUrlChange);
    }, []);

    return <>{dom}</>;
}