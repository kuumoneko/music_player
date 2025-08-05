import { faSpotify, faYoutube } from '@fortawesome/free-brands-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useEffect, useState } from 'react';
import { goto } from '../../utils/url.ts';
import { faFileAudio } from '@fortawesome/free-solid-svg-icons';
import { Data, fetch_data } from '../../utils/fetch.ts';

export default function Sidebar({
    url,
    seturl
}: {
    url: string,
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

                // console.log(new_ytb_ply)
                ytb_temp.push(...new_ytb_ply);
            }

            if (playlist.spotify.length > 0) {
                const new_spt_ply = (playlist.spotify as any[]).filter((item: any) =>
                    !(spotify as any[]).map((playlist: any) => playlist.playlistId).includes(item.playlistId) && typeof item !== 'string'
                )

                // console.log(new_spt_ply)
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
        // Converted from .sidebar in index.css
        // Added light mode styles (bg-slate-100, text-slate-800) and dark mode variants
        <aside className="w-[20%] max-w-[250px] h-[95%] p-5 bg-slate-100 text-slate-800 dark:bg-black dark:text-white">

            {/* Converted from .sidebar .logo h1 */}
            <div className="logo mb-5">
                <h1 className="text-2xl font-bold">Music App</h1>
            </div>

            <nav className="navigation">
                <h2 className="mb-2.5 text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-neutral-400 cursor-default select-none">liked songs</h2>
                <ul className="list-none p-0 m-0">
                    <li className="mb-2.5 cursor-default select-none" onClick={() => {
                        goto("/liked_songs/youtube", seturl)
                        // window.location.href = "/liked_songs/youtube"
                    }}>
                        <FontAwesomeIcon icon={faYoutube} className='text-red-500 mr-[5px]' />
                        <a className="text-gray-600 dark:text-neutral-400 no-underline hover:text-black dark:hover:text-white">Youtube</a>
                    </li>
                    <li className="mb-2.5 cursor-default select-none"
                        onClick={() => {
                            goto("/liked_songs/spotify", seturl)
                            // window.location.href = "/liked_songs/spotify"
                        }}>
                        <FontAwesomeIcon icon={faSpotify} className='text-green-500 mr-[5px]' />

                        <a className="text-gray-600 dark:text-neutral-400 no-underline hover:text-black dark:hover:text-white">Spotify</a>
                    </li>
                    <li className="mb-2.5 cursor-default select-none"
                        onClick={() => {
                            goto("/local", seturl)
                            // window.location.href = "/local"
                        }}>
                        <FontAwesomeIcon icon={faFileAudio} className='text-slate-300 mr-[5px]' />

                        <a className="text-gray-600 dark:text-neutral-400 no-underline hover:text-black dark:hover:text-white">Local File</a>
                    </li>
                </ul>
            </nav>

            {/* Converted from .sidebar .playlists */}
            <div className="playlists mt-5 cursor-default select-none h-[100%]">
                {/* Converted from .sidebar .playlists h2 */}
                <h2 className="mb-2.5 text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-neutral-400 cursor-default select-none">Playlists</h2>
                <div className="showplaylist p-0 m-0 flex flex-col w-[100%] overflow-y-scroll [&::-webkit-scrollbar]:hidden h-[80%]">
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
                                        // window.location.href = `/playlist/spotify/${item.playlistId}`
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

                    {/* <li className="mb-2.5"><a href="#" className="text-gray-600 dark:text-neutral-400 no-underline hover:text-black dark:hover:text-white">Liked Songs</a></li>
                    <li className="mb-2.5"><a href="#" className="text-gray-600 dark:text-neutral-400 no-underline hover:text-black dark:hover:text-white">My Playlist #1</a></li> */}
                </div>
            </div>
        </aside>
    );
};
