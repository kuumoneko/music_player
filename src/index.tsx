// @ts-nocheck
import Server from "./server.tsx";
import { running } from "./prerun.tsx";
running();
localStorage.setItem("url", "/");

import React, { useEffect, useState } from "react";
import { Server_mode } from "./types/index.ts";
import { createRoot } from "react-dom/client";

const root_element = document.getElementById("root");

const root = createRoot(root_element as HTMLElement);

try {
    root.render(<Server />);
} catch (e) {
    console.log(e);
    root.render(<div>{e}</div>);
}
