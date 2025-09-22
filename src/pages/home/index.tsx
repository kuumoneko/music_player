import Homepage from "./home/index.tsx";
import Music from "./music/index.tsx";
import Queue from "./queue/index.tsx";
import Search from "./search/index.tsx"
import Show_search from "./search/show_search.tsx";


export default function Home({ url, seturl }: { url: string, seturl: (a: string) => void }) {
    const urll = url.split("/").slice(1);

    return (
        <div className="home text-gray-400 dark:text-neutral-200 no-underline bg-slate-200 dark:bg-slate-700 flex flex-col items-center rounded-xl w-[80%] h-[100%]">
            <Search url={url} seturl={seturl} />
            {
                urll[0] === "" && (
                    <Homepage seturl={seturl}/>
                )
            }
            {
                urll[0] === "search" && (
                    <Show_search urll={url} />
                )
            }
            {
                (["liked_songs", "playlist", "album", "track", "local", "artist"].includes(urll[0])) && (
                    <Music urll={url} seturl={seturl} />
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