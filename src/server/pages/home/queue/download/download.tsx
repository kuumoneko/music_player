import { faDownload } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useState } from "react";
import { Data, fetch_data } from "../../../../common/utils/fetch.ts";

enum Status {
    idle = "idle",
    downloading = "downloading",
    done = "done",
}

export default function Download({ list }: { list: any[] }) {
    const [download, setdownload] = useState<boolean>(false);
    const [status, setstatus] = useState<Status>(Status.idle);

    useEffect(() => {
        const intervalId = window.setInterval(() => {
            try {
                async function get_download_status() {
                    if (!status) return;
                    const data = await fetch_data(Data.download_status);
                    // const data = await get("/download_status");
                    if (data.status == "done") {
                        setstatus(Status.done);
                        setdownload(false);
                    }
                    if (data.status == "downloading") {
                        setstatus(Status.downloading);
                    }
                }
                if (status !== "done") {
                    get_download_status();
                }
            } catch { }
        }, 2500);
        return () => window.clearInterval(intervalId);
    }, []);

    useEffect(() => {
        async function run() {
            // console.log(list)
            try {
                const links = list.map((item: any) => {
                    return {
                        source: item.source,
                        mode: item.mode,
                        id: item.id,
                    };
                });
                console.log(links);
                const format = localStorage.getItem("preferredAudioFormat");
                const data = await fetch_data(Data.download, {
                    format: format,
                    links: links,
                });
                if (data.message == "OK") {
                    setstatus(Status.downloading);
                }
            }
            catch (e) {
                console.log(e)
            }
        }
        if (download) {
            run();
        }
    }, [download]);

    return (
        <div>
            <span
                className="bg-green-400 hover:bg-green-300 h-[45px] w-[150px] flex flex-row items-center justify-between rounded-full"
                onClick={() => {
                    setdownload(true);
                }}
            >
                <span className="bg-slate-50 h-9 w-9 rounded-[50px] ml-[6px] flex flex-row items-center justify-center">
                    <FontAwesomeIcon
                        icon={faDownload}
                        className="text-slate-700 size-4"
                    />
                </span>
                <span className="mr-[15px] flex flex-col items-center justify-center mt-[2px] text-lg text-slate-600 transition-all">
                    {status === Status.idle && "Download"}
                    {status === Status.downloading && "Downloading..."}
                    {status === Status.done && "Done..."}
                </span>
            </span>
        </div>
    );
}
