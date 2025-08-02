import { faSpotify } from "@fortawesome/free-brands-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useState } from "react";
import { goto } from "../../../../utils/url.ts";
import { Data, fetch_data } from "../../../../utils/fetch.ts";

export default function Spotify_Account({
    url,
    seturl
}: {
    url: string,
    seturl: (a: string) => void
}) {


    let spotify: any = JSON.parse(localStorage.getItem("user") as string).spotify || null;

    const [logined, setlogined] = useState(false);

    useEffect(() => {
        async function login() {
            if (logined === false) {
                return;
            }
            const data = await fetch_data(Data.login, { where: "spotify" })

            if (data.user == undefined) {
                return goto("/settings", seturl)
            }
            localStorage.setItem("user", JSON.stringify({
                youtube: JSON.parse(localStorage.getItem("user") as string).youtube,
                spotify: {
                    user: {
                        name: data.user.display_name,
                        email: data.user.email,
                        id: data.user.id,
                    }
                }
            }));
            spotify = data.user;
            goto("/settings", seturl)
            return;
        }
        login();
    }, [logined])

    const [logout, setlogout] = useState(false);

    useEffect(() => {
        async function run() {
            await fetch_data(Data.logout, { where: "spotify" });

            localStorage.setItem("user", JSON.stringify({
                youtube: JSON.parse(localStorage.getItem("user") as string).youtube,
                spotify: {
                    user: {
                        name: "",
                        email: "",
                        id: "",
                    },
                }
            }));
            return goto("/settings", seturl)
        }
        if (logout) {
            run()
        }
    }, [logout])

    return (
        <div>
            <span className="flex flex-row justify-between items-center">
                <span>
                    <FontAwesomeIcon icon={faSpotify} />
                    <span className="text-lg font-semibold text-gray-800 dark:text-gray-200 ml-2">Spotify:</span>
                </span>

                {
                    (spotify.user.name === "") ?
                        (
                            <div className="cursor-default" onClick={() => {
                                setlogined(true)
                            }} >
                                <span className="border-solid rounded-[50px] bg-white py-[5px] px-[10px] text-black flex flex-row">
                                    <span className="flex items-center justify-center mr-[5px]">
                                        <FontAwesomeIcon icon={faSpotify} className="text-green-400 h-[20px] w-[20px]" />
                                    </span>
                                    Log in
                                </span>
                            </div>
                        ) : (
                            <div className="flex flex-row-reverse items-center justify-center">
                                <span className="pl-[5px]">
                                    {spotify.user.name}
                                </span>
                            </div>
                        )
                }

            </span>
            {
                (spotify.user.name !== "") && (
                    <span className="cursor-default flex flex-row-reverse items-center" onClick={() => {
                        setlogout(true)
                    }}>
                        log out
                    </span>
                )
            }
        </div >
    )
}

