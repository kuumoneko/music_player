import { useEffect, useState } from "react";
import "./index.css";

import { goto } from "./common/utils/url.ts";

import MainContent from "./pages/index.tsx";
import Nav from "./common/components/Navigator/index.tsx";

export default function Server() {
    const [url, seturl] = useState(localStorage.getItem("url") || `/`);

    const general_url = new URL(window.location.href);
    const code = general_url.searchParams.get("code"),
        scope = general_url.searchParams.get("scope");

    if (code !== null) {
        goto(
            `/settings/${scope !== null ? "youtube" : "spotify"}/${code}`,
            seturl
        );
        window.location.href = "/";
    }

    return (
        <>
            <div className="app flex h-screen w-screen items-center justify-between flex-col overflow-hidden m-0 p-0 select-none cursor-default">
                <Nav url={url} seturl={seturl} />
                <MainContent url={url} seturl={seturl} />
            </div>
        </>
    );
}
