import { goto } from "@/mainview/utils/url.ts";
import { faGear } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

export default function Settings() {
    return (
        <div className="header-icons flex top-5 right-5 gap-3.75 items-center rounded-full py-0.5 px-1 hover:cursor-pointer hover:bg-slate-500">
            <span className="settings" onClick={() => goto("/settings")}>
                <FontAwesomeIcon icon={faGear} />
            </span>
        </div>
    );
}
