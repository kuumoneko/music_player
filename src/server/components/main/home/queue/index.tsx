// import { get } from "../../../../../dist/function/url";
import Download_Queue from "./download";
import Play_Queue from "./play";


export default function Queue({ urll }: { urll: string }) {
    const url = urll.split("/").slice(3);

    return (
        <>
            {
                url[1] === "play" ? (
                    <Play_Queue />
                ) : (
                    <Download_Queue />
                )
            }
        </>
    )
}