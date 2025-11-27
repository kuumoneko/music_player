import { useEffect, useState } from "react";
import Pages from "@/pages/index.tsx";
import Player from "@/components/Player/index.tsx";
import Nav from "@/components/Navigator/index.tsx";
import SearchBar from "@/components/Search/index.tsx";
import Settings from "./pages/settings/index.tsx";
import localstorage from "./utils/localStorage.ts";

function App() {
    const [url, seturl] = useState(localstorage("get", "url", "/"));
    useEffect(() => {
        localstorage("set", "playedsongs", []);
        localstorage("set", "backward", []);
        localstorage("set", "forward", []);
        const run = setInterval(() => {
            seturl(localstorage("get", "url", "/"));
        }, 50);
        return () => clearInterval(run);
    }, []);

    return (
        <div className="w-screen h-screen flex flex-col items-center justify-center bg-slate-900 cursor-default select-none">
            <Nav />
            <div className="w-full h-[85%]">
                <div className="h-[5%] bg-slate-900"></div>
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
