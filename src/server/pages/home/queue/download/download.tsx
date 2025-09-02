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
    const [data, setdata] = useState<string>("");

    useEffect(() => {
        const intervalId = window.setInterval(() => {
            try {
                async function get_download_status() {
                    if (!status) return;
                    const data: { status: { data: string, track: string } } = await fetch_data(Data.download_status);

                    if (data.status.data == Status.done) {
                        setstatus(Status.done);
                        setdownload(false);
                        setdata("")
                    }
                    else if (data.status.data == Status.downloading) {
                        setstatus(Status.downloading);
                    }
                    else if (data.status.data === Status.idle) {
                        setstatus(Status.idle);
                    }
                    else {
                        setdata(data.status.data + " " + data.status.track);
                    }
                }
                if (status !== "done") {
                    get_download_status();
                }
            } catch { }
        }, 200);
        return () => window.clearInterval(intervalId);
    }, []);

    useEffect(() => {
        async function run() {
            const links = list.map((item: any) => {
                return {
                    source: item.source,
                    mode: item.mode,
                    id: item.id,
                };
            });
            const format = localStorage.getItem("preferredAudioFormat");
            const data = await fetch_data(Data.download, {
                format: format,
                links: links,
            });
            if (data.message == "OK") {
                setstatus(Status.downloading);
            }
        }
        if (download && status === Status.idle) {
            run();
        }
    }, [download]);

    return (
        <div className="information flex flex-row items-center gap-5">
            <span
                className="bg-green-400 hover:bg-green-300 h-[45px] w-[150px] flex flex-row items-center justify-between rounded-full"
                onClick={() => {
                    if (status === Status.idle) {
                        setdownload(true);
                    }
                    else {
                        setdata("Now you cant click this")
                    }
                }}
            >
                <span className="bg-slate-50 h-9 w-9 rounded-[50px] ml-[6px] flex flex-row items-center justify-center">
                    <FontAwesomeIcon
                        icon={faDownload}
                        className="text-slate-700 size-4"
                    />
                </span>
                <span className="mr-[15px] flex flex-col items-center justify-center mt-[2px] text-lg text-slate-600 transition-all">
                    Download
                </span>

            </span>
            <span>
                {
                    data
                }
            </span>
        </div>
    );
}
