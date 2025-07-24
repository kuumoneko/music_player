// @ts-nocheck

import './index.css';

import Server from './server/index.tsx';
import { running } from './prerun.tsx';
running();

import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

const root_element = document.getElementById("root");

const root = createRoot(root_element as HTMLElement);

// const enum Server_mode {
//     server = "server",
//     test = "test"
// }

// const mode: Server_mode = Server_mode.server;


try {
    localStorage.setItem("port", "3001")
    root.render(
        <>
            <Server />
        </>
    )
}
catch (e) {
    console.log(e)
    root.render(
        <div>
            {e}
        </div>
    )
}
