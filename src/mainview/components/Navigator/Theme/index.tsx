import { goto } from "@/utils/url.ts";
import { faGear } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

export default function Settings() {
    return (
        <div className="header-icons flex top-5 right-5 gap-3.75 items-center cursor-pointer">
            <span className="settings" onClick={() => goto("/settings")}>
                <FontAwesomeIcon icon={faGear} />
            </span>
        </div>
    );
}
