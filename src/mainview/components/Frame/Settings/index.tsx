import { goto } from "@/mainview/utils/url.ts";
import { faGear } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

export default function Settings() {
    return (
        <div className="header-icons w-1/5 flex top-5 right-5 gap-3.75 flex-row-reverse">
            <span
                className="settings rounded-full py-0.5 px-1 hover:cursor-pointer hover:bg-slate-500"
                onClick={() => goto("/settings")}
            >
                <FontAwesomeIcon icon={faGear} />
            </span>
        </div>
    );
}
