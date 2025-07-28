import Music from "./music/index.tsx";
import Queue from "./queue/index.tsx";
import Search from "./search/index.tsx"
import Show_search from "./search/show_search.tsx";


export default function Home({ url, seturl }: { url: string, seturl: (a: string) => void }) {
    // get url
    const urll = url.split("/").slice(3);

    return (
        <div className="home text-gray-400 dark:text-neutral-200 no-underline bg-slate-200 dark:bg-slate-700 flex flex-col items-center rounded-xl w-[80%] h-[95%]">
            <Search url={url} seturl={seturl} />
            {
                urll[0] === "" && (
                    <>
                    </>
                )
            }
            {
                urll[0] === "search" && (
                    <Show_search urll={url} />
                )
            }
            {
                (urll[0] === "liked_songs" || urll[0] === "playlist" || urll[0] === "album" || urll[0] === "track" || urll[0] === "local") && (
                    <Music urll={url} />
                )
            }
            {
                (urll[0] === "queue") && (
                    <Queue urll={url} />
                )
            }
        </div>
    )
}