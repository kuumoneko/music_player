import { useState, useEffect } from "react";
import { goto } from "../../../../utils/url.ts";

export default function DataUI({
    seturl
}: { seturl: (a: string) => void }) {
    const playing = JSON.parse(localStorage.getItem("playing") as string) || {
        id: "",
        name: "",
        artists: "",
        thumbnail: "",
        source: "",
        duration: "",
    }

    const [id, setid] = useState<any>(playing.id);
    const [name, setname] = useState<any>(playing.name);
    const [artists, setartists] = useState<any>(playing.artists);
    const [thumbnail, setthumbnail] = useState<any>(playing.thumbnail);
    const [source, setsource] = useState<any>(playing.source);

    useEffect(() => {
        const run = window.setInterval(() => {
            async function run() {
                const data = JSON.parse(localStorage.getItem("playing") as string);
                setname(data.name);
                setartists(data.artists);
                setthumbnail(data.thumbnail);
                setid(data.id);
                setsource(data.source);
            }
            run();
        }, 200);
        return () => window.clearInterval(run);
    }, [])

    return (
        <div className='flex flex-row items-center ml-[15px]'>
            <span>
                {
                    thumbnail ? (
                        <img src={thumbnail as string} alt="" height={50} width={50} className="rounded-lg" />

                    ) : (
                        <>

                        </>
                    )
                }
            </span>
            <div className="currently-playing ml-[5px] cursor-default select-none flex flex-col">
                {
                    (id !== "") && (
                        <span className='text-sm hover:underline hover:cursor-pointer' onClick={() => {
                            goto(`/track/${source}/${id}`, seturl)
                        }}>
                            {
                                name?.slice(0, 30)
                            }
                        </span>
                    )
                }
                {
                    (artists !== "") && (
                        <span className='text-sm'>
                            {
                                artists
                            }
                        </span>
                    )
                }
            </div>
        </div>
    )
}