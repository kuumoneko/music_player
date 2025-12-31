import { faDatabase } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import fetchdata from "@/utils/fetch.ts";
import { goto } from "@/utils/url";

export default function Profile() {
    return (
        <div>
            <span className="flex flex-row justify-between items-center">
                <span>
                    <FontAwesomeIcon icon={faDatabase} />
                    <span className="text-lg font-semibold text-gray-200 ml-2">
                        Import Profile:
                    </span>
                </span>
                <span>
                    <div
                        className="rounded-2xl h-5 w-20 flex flex-row items-center justify-center p-2 bg-slate-50 text-slate-700 hover:cursor-pointer hover:bg-slate-200"
                        onClick={async () => {
                            const result = await fetchdata("import", "GET");
                            if (result === "ok") {
                                goto("/");
                            }
                        }}
                    >
                        Import
                    </div>
                </span>
            </span>
        </div>
    );
}
