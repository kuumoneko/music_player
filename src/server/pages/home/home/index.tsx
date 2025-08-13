import { useEffect, useState } from "react"
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faThumbTack } from '@fortawesome/free-solid-svg-icons';
import { goto } from "../../../common/utils/url";
import { Data, fetch_data } from "../../../common/utils/fetch";
import { Track } from "../../../../types";
import Play from "../../../common/components/Show_music/common/play";

// i will add suggestion for spotify and youtube here
export default function Homepage({ seturl }: { seturl: (a: string) => void }) {
    const [playlist, setplaylist] = useState("[]");
    const [artist, setartist] = useState("[]");

    useEffect(() => {
        const run = setInterval(() => {
            const pinned: any[] = JSON.parse(localStorage.getItem("pin") || "[]");
            const playlist = pinned.filter((item: any) => {
                return item.mode === "playlist"
            })
            const artist = pinned.filter((item: any) => {
                return item.mode === "artist"
            })

            setplaylist(JSON.stringify(playlist));
            setartist(JSON.stringify(artist));
            // setpin(pinned)
        }, 500);
        return () => clearInterval(run)
    }, [])

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
        <div className="home w-[100%]">
            <span className="w-[100%] flex flex-row items-center justify-center">
                Home
            </span>
            <div className="flex flex-col w-[100%] ml-[15px] h-[10%]">
                <div>
                    <span>
                        <FontAwesomeIcon icon={faThumbTack} />
                    </span>
                    <span>
                        Your pin:
                    </span>
                </div>
                <div className="flex flex-row w-[95%] mt-[20px] max-h-[75%] overflow-x-scroll [&::-webkit-scrollbar]:hidden">
                    {
                        (JSON.parse(artist) as any[]).map((item: any) => {
                            const temp = (item.mode === "playlist") ? 100 : 50
                            return (
                                <div key={item.name} className="flex flex-row items-center bg-slate-800 p-[10px] rounded-3xl mr-[20px]"
                                    onClick={() => {
                                        goto(`/artist/${item.source}/${item.id}`, seturl)
                                    }}
                                >
                                    <span className="mr-[5px]">
                                        <img src={item.thumbnail} className="rounded-lg" height={temp} width={temp} />
                                    </span>
                                    <span>
                                        {
                                            item.name
                                        }
                                    </span>
                                </div>
                            )
                        })
                    }
                </div>
                <div className="flex flex-row w-[95%] mt-[20px]">
                    {
                        (JSON.parse(playlist) as any[]).map((item: any) => {
                            const temp = (item.mode === "playlist") ? 100 : 50
                            return (
                                <div key={item.name} className="flex flex-row items-center bg-slate-800 p-[10px] rounded-3xl mr-[20px]"
                                    onClick={() => {
                                        goto(`/playlist/${item.source}/${item.id}`, seturl)
                                    }}
                                >
                                    <span className="mr-[5px]">
                                        <img src={item.thumbnail} className="rounded-lg" height={temp} width={temp} />
                                    </span>
                                    <span>
                                        {
                                            item.name
                                        }
                                    </span>
                                </div>
                            )
                        })
                    }
                </div>
            </div>
            <div className="new tracks grid grid-cols-3 gap-4 ml-[15px] mt-[15px] max-h-[18%] w-[100%] overflow-y-scroll [&::-webkit-scrollbar]:hidden">
                {
                    (JSON.parse(newtracks) as Track[]).map((item: Track, index: number) => {
                        return (
                            <div key={item.track?.name || `new tracks ${index + 1}`} className="flex flex-row h-[100px] w-[500px] bg-slate-800 hover:bg-slate-500 p-[5px] items-center rounded-2xl"
                                onClick={() => {
                                    Play(item, item.type.split(":")[0], "track", item.track.id, [])
                                }}
                            >
                                <span className="h-[100%] w-[100px] flex items-center justify-center">
                                    <img src={item.thumbnail || ""} height={100} width={100} />
                                </span>
                                <div className="flex flex-col ml-[10px] items-start w-[400px]">
                                    <span className="text-sm w-[100%]">
                                        {
                                            item.track.name
                                        }
                                    </span>
                                    <span>
                                        {
                                            item.artists.map((item: any) => { return item.name }).join(", ")
                                        }
                                    </span>
                                </div>

                            </div>
                        )
                    })
                }
            </div>
        </div>
    )
}