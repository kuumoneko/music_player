import { faYoutube } from "@fortawesome/free-brands-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { useEffect, useState } from "react";
import { goto } from "../../../../utils/url.ts";
import { Data, fetch_data } from "../../../../utils/fetch.ts";


export default function Youtube_Account({
    url, seturl
}: { url: string, seturl: (a: string) => void }) {

    let youtube: any = JSON.parse(localStorage.getItem("user") as string).youtube || null;

    // const [credential, setcredential] = useState(url.split("youtube/")[1]);

    // useEffect(() => {
    //     async function run() {
    //         if (credential === undefined || credential === "") {
    //             return;
    //         }
    //         console.log(credential)
    //         const data = await post("/auth/youtube", { code: credential });
    //         // const res = await fetch("http://localhost:3001/auth/youtube", {
    //         //     method: "POST",
    //         //     headers: {
    //         //         "Content-Type": "application/json"
    //         //     },
    //         //     body: JSON.stringify({ code: credential })

    //         // });
    //         // const data = await res.json();
    //         // console.log(data);
    //         if (data.user == undefined) {
    //             return goto("/settings", seturl)

    //             // localStorage.setItem("url", `http://locahost:3001/settings`)
    //         }

    //         localStorage.setItem("user", JSON.stringify({
    //             spotify: JSON.parse(localStorage.getItem("user") as string).spotify,
    //             youtube: {
    //                 user: {
    //                     name: `${data.user.name}`,
    //                     thumbnail: data.user.thumbnail
    //                 }
    //             }
    //         }));
    //         youtube = data.user;
    //         goto("/settings", seturl)
    //         window.location.href = "/"
    //         return;
    //         // localStorage.setItem("url", `http://locahost:3001/settings`)

    //     }
    //     run();
    // }, [credential])

    const [logined, setlogined] = useState(false);

    useEffect(() => {

        async function login() {
            if (logined === false) {
                return;
            }
            const data = await fetch_data(Data.login, { where: "youtube" });
            // const data = await post("/auth/youtube", { code: credential });
            // const res = await fetch("http://localhost:3001/auth/youtube", {
            //     method: "POST",
            //     headers: {
            //         "Content-Type": "application/json"
            //     },
            //     body: JSON.stringify({ code: credential })

            // });
            // const data = await res.json();
            // console.log(data);
            if (data.user == undefined) {
                return goto("/settings", seturl)
            }

            localStorage.setItem("user", JSON.stringify({
                spotify: JSON.parse(localStorage.getItem("user") as string).spotify,
                youtube: {
                    user: {
                        name: `${data.user.name}`,
                        thumbnail: data.user.thumbnail
                    }
                }
            }));
            youtube = data.user;
            goto("/settings", seturl)
            // window.location.reload();
            return;
        }
        login();
    }, [logined])

    const [logout, setlogout] = useState(false);

    useEffect(() => {
        async function run() {
            await fetch_data(Data.logout, { where: "youtube" });
            // await get("/logout/youtube");

            localStorage.setItem("user", JSON.stringify({
                spotify: JSON.parse(localStorage.getItem("user") as string).spotify,
                youtube: {
                    user: {
                        name: "",
                        thumbnail: ""
                    }
                },
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
                    <FontAwesomeIcon icon={faYoutube} />
                    <span className="text-lg font-semibold text-gray-800 dark:text-gray-200 ml-2">Youtube:</span>
                </span>

                {
                    (youtube.user.name === "") ?
                        (
                            <div className="cursor-default" onClick={() => {
                                setlogined(true);
                            }} >
                                <span className="border-solid rounded-[50px] bg-white py-[5px] px-[10px] text-black flex flex-row">
                                    <span className="flex items-center justify-center mr-[5px]">
                                        <FontAwesomeIcon icon={faYoutube} className="text-red-500 h-[20px] w-[20px]" />
                                    </span>
                                    Log in
                                </span>
                            </div>
                        ) : (
                            <div className="flex flex-row-reverse items-center justify-center">
                                <span className="pl-[5px]">
                                    {youtube.user.name}
                                </span>
                                <span>
                                    <img src={`${youtube.user.thumbnail}`} height={20} width={20} />
                                </span>
                            </div>
                        )
                }

            </span>
            {
                (youtube.user.name !== "") && (
                    <span className="cursor-default flex flex-row-reverse items-center" onClick={() => {
                        // localStorage.setItem("user", JSON.stringify({
                        //     spotify: JSON.parse(localStorage.getItem("user") as string).spotify,
                        //     youtube: {
                        //         user: {
                        //             name: "",
                        //             thumbnail: ""
                        //         }
                        //     },
                        // }));
                        // return goto("/settings", seturl)
                        setlogout(true)

                        // localStorage.setItem("url", `http://locahost:3001/settings`)
                    }}>
                        log out
                    </span>
                )
            }

        </div >
    )
}