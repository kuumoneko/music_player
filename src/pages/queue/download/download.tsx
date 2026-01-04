import { faDownload } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useState } from "react";
import fetchdata from "@/utils/fetch.ts";

enum Status {
    idle = "idle",
    downloading = "downloading",
    done = "done",
}

export default function Download() {
    const [download, setdownload] = useState<boolean>(false);
    const [status, setstatus] = useState<Status>(Status.idle);
    const [data, setdata] = useState<string>("");

    useEffect(() => {
        const intervalId = window.setInterval(() => {
            try {
                async function get_download_status() {
                    if (!status) return;
                    const { data, track } = await fetchdata(
                        "downloadstatus",
                        "GET"
                    );
                    if (data == Status.done) {
                        setstatus(Status.done);
                        setdownload(false);
                        setdata("");
                    } else if (data == Status.downloading) {
                        setstatus(Status.downloading);
                    } else if (data === Status.idle) {
                        setstatus(Status.idle);
                    } else {
                        setdata(data + " " + track);
                    }
                }
                if (status !== "done") {
                    get_download_status();
                }
            } catch {}
        }, 200);
        return () => window.clearInterval(intervalId);
    }, []);

    useEffect(() => {
        async function run() {
            const res = await fetchdata("download", "GET");
            if (res == "OK") {
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
                className="bg-green-400 hover:bg-green-300 h-11.25 w-37.5 flex flex-row items-center justify-between rounded-full"
                onClick={() => {
                    if (status === Status.idle) {
                        setdownload(true);
                    } else {
                        setdata("Now you cant click this");
                    }
                }}
            >
                <span className="bg-slate-50 h-9 w-9 rounded-[50px] ml-1.5 flex flex-row items-center justify-center">
                    <FontAwesomeIcon
                        icon={faDownload}
                        className="text-slate-700 size-4"
                    />
                </span>
                <span className="mr-3.75 flex flex-col items-center justify-center mt-0.5 text-lg text-slate-600 transition-all">
                    Download
                </span>
            </span>
            <span>{data}</span>
        </div>
    );
}
