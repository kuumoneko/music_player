// @ts-nocheck
import Server from './server/index.tsx';
import Test from './test/server.tsx';
import { running } from './prerun.tsx';
running();

import React, { useEffect, useState } from 'react';
import { Server_mode } from "../types/index.ts"
import { createRoot } from 'react-dom/client';

import "./electron.d.ts"
const root_element = document.getElementById("root");

const root = createRoot(root_element as HTMLElement);


const mode: Server_mode = Server_mode.server;


try {
    localStorage.setItem("port", "3001")
    root.render(
        <>
            {
                mode === Server_mode.server ? (
                    <Server />
                ) : (
                    <Test />
                )
            }
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
