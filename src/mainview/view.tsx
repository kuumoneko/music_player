import { useEffect, useState } from "react";
import Pages from "@/mainview/pages/index.tsx";
import Player from "@/mainview/components/Player/index.tsx";
import SearchBar from "@/mainview/components/Search/index.tsx";
import Settings from "./pages/settings/index.tsx";
import localstorage from "./utils/localStorage.ts";
import Frame from "./components/Frame/index.tsx";

function App() {
    const [url, seturl] = useState(localstorage("get", "url", "/"));
    useEffect(() => {
        localstorage("set", "backward", "[]");
        localstorage("set", "forward", "[]");
        localstorage("set", "search", "");
        const onUrlChange = (e: Event) => seturl((e as CustomEvent).detail);
        window.addEventListener("urlchange", onUrlChange);
        return () => window.removeEventListener("urlchange", onUrlChange);
    }, []);

    return (
        <div className="w-screen h-screen flex flex-col items-center justify-center bg-zinc-900 cursor-default select-none">
            <Frame />
            <div className="w-full h-[85%]">
                <div className="h-[5%] bg-zinc-900"></div>
                <SearchBar />
                <div className="h-[90%] flex flex-col items-center justify-center">
                    <Pages url={url} />
                    <Settings isOpen={url.includes("settings")} />
                </div>
            </div>
            <Player />
        </div>
    );
}

export default App;
