import { faHourglassStart } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useState } from "react";

export default function Autostart() {
    const [isStarted, setIsStarted] = useState<boolean | null>(null);
    useEffect(() => {
        async function run() {
            const isAutoStart = await window.api.rpc.request.isAutoStart();
            setIsStarted(isAutoStart ?? false);
        }
        run();
    }, []);
    return (
        <div>
            <span className="flex flex-row justify-between items-center">
                <span>
                    <FontAwesomeIcon icon={faHourglassStart} />
                    <span className="text-lg font-semibold text-gray-200 ml-2">
                        Start with Windows:
                    </span>
                </span>
                <span>
                    <div
                        className="bg-slate-50 px-3 text-slate-800 rounded-2xl hover:cursor-pointer hover:bg-slate-200"
                        onClick={() => {
                            setIsStarted(isStarted ? !isStarted : true);
                            window.api.rpc.request.toggleAutoStart();
                        }}
                    >
                        {!isStarted ? "Yes" : "No"}
                    </div>
                </span>
            </span>
        </div>
    );
}
