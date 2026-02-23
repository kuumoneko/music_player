import { faDiscord } from "@fortawesome/free-brands-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useState } from "react";

export default function Discord() {
    const [username, setUsername] = useState<string>("");
    async function run() {
        const res = await window.api.rpc.request.checkIfRPC();
        setUsername(res.data ?? "Discord RPC is not connected");
    }

    useEffect(() => {
        run();
    }, []);

    return (
        <div>
            <span className="flex flex-row justify-between items-center">
                <span>
                    <FontAwesomeIcon icon={faDiscord} />
                    <span className="text-lg font-semibold text-gray-200 ml-2">
                        Discord RPC:
                    </span>
                </span>
                <span
                    className="hover:cursor-pointer"
                    onClick={() => {
                        if (username === "Discord RPC is not connected") {
                            window.api.rpc.request.connect();
                            setTimeout(() => {
                                run();
                            }, 1000);
                        }
                    }}
                >
                    {username !== "Discord RPC is not connected"
                        ? username
                        : "Connect"}
                </span>
            </span>
        </div>
    );
}
