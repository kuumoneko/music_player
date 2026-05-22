import { faDownload } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useState } from "react";

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
        const handler = (payload: { data: string; track: string }) => {
            if (payload.data == Status.done) {
                setstatus(Status.done);
                setdownload(false);
                setdata("");
            } else if (payload.data == Status.downloading) {
                setstatus(Status.downloading);
            } else if (payload.data === Status.idle) {
                setstatus(Status.idle);
            } else {
                setdata(payload.data + " " + payload.track);
            }
        };
        window.api.rpc.addMessageListener("download-status-changed", handler);
        return () => {
            window.api.rpc.removeMessageListener("download-status-changed", handler);
        };
    }, []);

    useEffect(() => {
        let cancelled = false;
        if (download && status === Status.idle) {
            window.api.rpc.request.downloadMusic().then((res) => {
                if (!cancelled && res == "ok") {
                    setstatus(Status.downloading);
                }
            });
        }
        return () => { cancelled = true; };
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
                <span className="bg-zinc-50 h-9 w-9 rounded-[50px] ml-1.5 flex flex-row items-center justify-center">
                    <FontAwesomeIcon
                        icon={faDownload}
                        className="text-zinc-700 size-4"
                    />
                </span>
                <span className="mr-3.75 flex flex-col items-center justify-center mt-0.5 text-lg text-zinc-600 transition-all">
                    Download
                </span>
            </span>
            <span>{data}</span>
        </div>
    );
}
