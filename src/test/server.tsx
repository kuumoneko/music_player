import { useState, useEffect } from "react";
import { fetch_data, Data } from "../server/common/utils/fetch";

export default function Test() {
    const [newtracks, setnewtracks] = useState("[]")
    useEffect(() => {
        async function run() {
            const pinned: any[] = JSON.parse(localStorage.getItem("pin") || "[]");
            const artist = pinned.filter((item: any) => {
                return item.mode === "artist"
            }).map((item: any) => { return { source: item.source, id: item.id } })
            const data = await fetch_data(Data.new_tracks, { items: artist });
            console.log(data);
            setnewtracks(JSON.stringify(data));
        }
        run();
    }, [])
    return (
        <div className="bg-slate-900 h-screen w-screen"></div>
    )
}