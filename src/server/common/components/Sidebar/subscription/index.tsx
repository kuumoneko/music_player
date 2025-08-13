import { faSpotify, faYoutube } from '@fortawesome/free-brands-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useEffect, useState } from 'react';
import { goto } from '../../../utils/url.ts';
import { Data, fetch_data } from '../../../utils/fetch.ts';

export default function Artist({
    seturl
}: {
    seturl: (a: string) => void
}) {
    const usr_artists = JSON.parse(localStorage.getItem("artists") as string) || {}
    const [youtube, setyoutube] = useState(usr_artists.youtube || []);
    const [spotify, setspotify] = useState(usr_artists.spotify || []);

    useEffect(() => {
        async function run() {

            const artists = await fetch_data(Data.likedartists);
            setspotify(artists.spotify);
            setyoutube(artists.youtube);
            localStorage.setItem("artists", JSON.stringify({
                spotify: artists.spotify,
                youtube: artists.youtube
            }))
        };
        run();
    }, [])

    return (
        <div className="showplaylist p-0 m-0 flex flex-col w-[100%] overflow-y-scroll [&::-webkit-scrollbar]:hidden h-[74%]">
            {
                youtube?.length !== 0 && youtube.map((item: {
                    id: string,
                    name: string,
                    thumbnail: string,
                }, index: number) => {
                    return (
                        <div key={`youtube ${index}`} className='my-[2px] hover:bg-slate-500 '>
                            <div className={`vid ${index + 1} flex h-[75px] w-[100%] flex-col justify-center`} onClick={() => {
                                goto(`/artist/youtube/${item.id}`, seturl)
                            }}>

                                <div className="flex flex-row items-center">
                                    <span className="thumbnail">
                                        <img src={item.thumbnail} alt="" height={50} width={50} className='rounded-full' />
                                    </span>
                                    <span className="title ml-[5px]">
                                        <span>
                                            <FontAwesomeIcon icon={faYoutube} className='text-red-500 mr-[5px]' />
                                        </span>
                                        {
                                            item.name?.slice(0, 10) || ""
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
                    id: string,
                    name: string,
                    thumbnail: string,
                }, index: number) => {
                    return (
                        <div key={`spotify ${index}`} className='my-[2px] hover:bg-slate-600'>
                            <div className={`vid ${index + 1} flex h-[80px] w-[100%] flex-col justify-center`} onClick={() => {
                                goto(`/artist/spotify/${item.id}`, seturl)
                            }}>

                                <div className="flex flex-row items-center">
                                    <span className="thumbnail">
                                        <img src={item.thumbnail} alt="" height={70} width={70} className='rounded-full' />
                                    </span>
                                    <span className="title ml-[5px]">
                                        <span>
                                            <FontAwesomeIcon icon={faSpotify} className='text-green-500 mr-[5px]' />
                                        </span>
                                        {
                                            item.name.slice(0, 10)
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
