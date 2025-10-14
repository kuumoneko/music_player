import { useState } from "react";
import "./index.css";

import MainContent from "./pages/index.tsx";
import Nav from "./components/Navigator/index.tsx";

export default function Server() {
    const [url, seturl] = useState(localStorage.getItem("url") || `/`);

    return (
        <>
            <div className="app flex h-screen w-screen items-center justify-between flex-col overflow-hidden m-0 p-0 select-none cursor-default">
                <Nav url={url} seturl={seturl} />
                <MainContent url={url} seturl={seturl} />
            </div>
        </>
    );
}
