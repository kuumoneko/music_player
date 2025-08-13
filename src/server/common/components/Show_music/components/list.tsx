import { faShare, faListDots, faDownload } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Track } from "../../../../../types";
import formatDuration from "../../../utils/format";
import Loading from "../../Loading";
import download from "../common/download";
import Play from "../common/play";
import Queue from "../common/queue";

export default function List({ list, source, id, mode }: { list: any[], source: string, id: string, mode: string }) {

    return (
        <div className="liked_songs flex flex-col max-h-[75%] w-[100%] overflow-y-scroll [&::-webkit-scrollbar]:hidden">
            {
                list?.length > 0 ? (
                    <>
                        {
                            list?.map((item: Track, index: number) => {
                                return (
                                    <div key={`list ${index}`} className={`vid ${index + 1} flex h-[200px] w-[100%] flex-row items-center justify-between mb-[20px] bg-slate-700 hover:bg-slate-600`}
                                        onDoubleClick={() => {
                                            Play(item, source, mode, id, list)
                                        }}>

                                        <div className="flex flex-row items-center ml-[10px]" >
                                            <span className="thumbnail cursor-default select-none" >
                                                <img src={item.thumbnail} alt="" height={100} width={100} />
                                            </span>
                                            <div className="flex flex-col ml-[10px]">
                                                <span className="title cursor-default select-none" >
                                                    {
                                                        item.track?.name || "cant load"
                                                    }
                                                </span>
                                                <span className="artists cursor-default select-none">{item.artists.map((artist: any) => artist.name).join(", ")}</span>
                                                <div className="flex flex-row items-center">
                                                    <span className="releaseDate cursor-default select-none">
                                                        {item.track?.releaseDate || "cant load"}
                                                    </span>
                                                    <span className="duration cursor-default select-none ml-[15px]">
                                                        {formatDuration(item.track?.duration as number / 1000) || "cant load"}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="action_button flex flex-row-reverse mr-[10px]">
                                            <span className="mr-[10px]" onClick={() => {
                                                if (source === "youtube") {
                                                    const url = "https://www.youtube.com/watch?v=" + item.track.id;
                                                    navigator.clipboard.writeText(url);
                                                }
                                                else {
                                                    const url = "https://open.spotify.com/track/" + item.track.id;
                                                    navigator.clipboard.writeText(url);
                                                }
                                            }}>
                                                <FontAwesomeIcon icon={faShare} />
                                            </span>
                                            <span className="mr-[10px]" onClick={() => {
                                                Queue(item, source)
                                            }}>
                                                <FontAwesomeIcon icon={faListDots} />
                                            </span>
                                            <span className={`mr-[10px] ${mode === "local" ? 'opacity-50 pointer-events-none' : ''}`} onClick={() => {
                                                download(item, source)
                                            }}>
                                                <FontAwesomeIcon icon={faDownload} />
                                            </span>

                                        </div>
                                    </div>
                                )
                            })
                        }
                    </>
                ) : (
                    <Loading mode={"Loading data"} />
                )
            }
        </div>
    )
}