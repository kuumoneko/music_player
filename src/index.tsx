// @ts-nocheck
import Server from "./server.tsx";
import { running } from "./prerun.tsx";
running();

import React, { useEffect, useState } from "react";
import { Server_mode } from "./types/index.ts";
import { createRoot } from "react-dom/client";

const root_element = document.getElementById("root");

const root = createRoot(root_element as HTMLElement);

const general_url = new URL(window.location.href);
const code = general_url.searchParams.get("code"),
    scope = general_url.searchParams.get("scope");

const hasVisited = sessionStorage.getItem("hasVisited") ?? false;
if (!hasVisited) {
    sessionStorage.setItem("hasVisited", "true");
    window.location.href = "/";
    localStorage.setItem("url", `/`);
}
if (code !== null) {
    localStorage.setItem(
        "url",
        `/settings/${scope !== null ? "youtube" : "spotify"}/${code}`
    );
    window.location.href = "/";
}

try {
    root.render(<Server />);
} catch (e) {
    console.log(e);
    root.render(<div>{e}</div>);
}
