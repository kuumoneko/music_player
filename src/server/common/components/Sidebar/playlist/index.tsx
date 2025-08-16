import { faSpotify, faYoutube } from '@fortawesome/free-brands-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useEffect, useState } from 'react';
import { goto } from '../../../utils/url.ts';
import { Data, fetch_data } from '../../../utils/fetch.ts';

export default function Playlist({
    seturl
}: {
    seturl: (a: string) => void
}) {
    const usr_playlists = JSON.parse(localStorage.getItem("playlists") as string) || {}
    const [youtube, setyoutube] = useState(usr_playlists.youtube || []);
    const [spotify, setspotify] = useState(usr_playlists.spotify || []);

    useEffect(() => {
        async function run() {
            const playlist = await fetch_data(Data.userplaylist);

            const ytb_temp: any[] = youtube.filter((item: any) => typeof item !== 'string') || [];
            const spt_temp: any[] = spotify.filter((item: any) => typeof item !== 'string') || [];

            if (playlist.youtube.length > 0) {
                const new_ytb_ply = (playlist.youtube as any[]).filter((item: any) =>
                    !(youtube as any[]).map((playlist: any) => playlist.playlistId).includes(item.playlistId) && typeof item !== 'string'
                )

                ytb_temp.push(...new_ytb_ply);
            }

            if (playlist.spotify.length > 0) {
                const new_spt_ply = (playlist.spotify as any[]).filter((item: any) =>
                    !(spotify as any[]).map((playlist: any) => playlist.playlistId).includes(item.playlistId) && typeof item !== 'string'
                )

                spt_temp.push(...new_spt_ply);
            }


            setspotify(spt_temp);
            setyoutube(ytb_temp);
            localStorage.setItem("playlists", JSON.stringify({
                spotify: spt_temp,
                youtube: ytb_temp
            }))
        };
        run();
    }, [])

    return (
        <div className="showplaylist p-0 m-0 flex flex-col w-[100%] overflow-y-scroll [&::-webkit-scrollbar]:hidden h-[74%]">
            {
                youtube?.length !== 0 && youtube.map((item: {
                    playlistId: string,
                    playlistName: string,
                    thumbnail: string,
                }, index: number) => {
                    return (
                        <div key={`youtube ${index}`} className='my-[2px] hover:bg-slate-500 '>
                            <div className={`vid ${index + 1} flex h-[75px] w-[100%] flex-col justify-center`} onClick={() => {
                                goto(`/playlist/youtube/${item.playlistId}`, seturl)
                            }}>

                                <div className="flex flex-row items-center">
                                    <span className="thumbnail">
                                        <img src={item.thumbnail} alt="" height={75} width={75} />
                                    </span>
                                    <span className="title ml-[5px]">
                                        <span>
                                            <FontAwesomeIcon icon={faYoutube} className='text-red-500 mr-[5px]' />
                                        </span>
                                        {
                                            item.playlistName?.slice(0, 10) || ""
                                        }

                                    </span>
                                </div>
                            </div>
                        </div>
                    )
                })
            }

            {
                spotify?.length !== 0 && spotify.map((item: {
                    playlistId: string,
                    playlistName: string,
                    thumbnail: string,
                }, index: number) => {
                    return (
                        <div key={`spotify ${index}`} className='my-[2px] hover:bg-slate-600'>
                            <div className={`vid ${index + 1} flex h-[80px] w-[100%] flex-col justify-center`} onClick={() => {
                                goto(`/playlist/spotify/${item.playlistId}`, seturl)
                            }}>

                                <div className="flex flex-row items-center">
                                    <span className="thumbnail">
                                        <img src={item.thumbnail} alt="" height={70} width={70} />
                                    </span>
                                    <span className="title ml-[5px]">
                                        <span>
                                            <FontAwesomeIcon icon={faSpotify} className='text-green-500 mr-[5px]' />
                                        </span>
                                        {
                                            item.playlistName.slice(0, 10)
                                        }

                                    </span>
                                </div>
                            </div>
                        </div>
                    )
                })
            }
        </div>
    );
};
