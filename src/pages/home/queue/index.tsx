import Download_Queue from "./download/index.tsx";
import Play_Queue from "./play/index.tsx";


export default function Queue({ urll }: { urll: string }) {
    const url = urll.split("/").slice(1);

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