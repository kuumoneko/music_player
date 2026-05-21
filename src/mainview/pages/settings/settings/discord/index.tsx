import { faDiscord } from "@fortawesome/free-brands-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useState } from "react";

export default function Discord() {
    const [username, setUsername] = useState<string | boolean | null>(null);

    useEffect(() => {
        let cancelled = false;
        window.api.rpc.request
            .isHasDiscordRPC()
            .then((data: string | boolean) => {
                if (!cancelled) setUsername(data);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    if (username === null) {
        return <></>;
    }

    return (
        <div>
            <span className="flex flex-row justify-between items-center">
                <span>
                    <FontAwesomeIcon icon={faDiscord} />
                    <span className="text-lg font-semibold text-zinc-200 ml-2">
                        Discord RPC:
                    </span>
                </span>
                <span
                    className="hover:cursor-pointer"
                    onClick={() => {
                        if (username === false) {
                            window.api.rpc.request
                                .connectDiscordRPC()
                                .then((data: string) => {
                                    setUsername(data);
                                });
                        }
                    }}
                >
                    {username === false ? "Connect" : username}
                </span>
            </span>
        </div>
    );
}
