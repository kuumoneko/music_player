import { faMinus, faXmark } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

const minimize = () => {
    if (window.electronAPI) {
        window.electronAPI.minimize();
    }
};

const close = () => {
    if (window.electronAPI) {
        window.electronAPI.close();
    }
};

export default function Frame() {
    return (
        <div className="h-[2%] w-full flex flex-row-reverse items-center justify-between">
            <div className="w-20 flex flex-row items-center justify-between px-4">
                <div
                    onClick={minimize}
                    className="cursor-default hover:cursor-pointer hover:bg-slate-500"
                >
                    <FontAwesomeIcon icon={faMinus} />
                </div>
                <div
                    onClick={close}
                    className="cursor-default hover:cursor-pointer hover:bg-slate-500"
                >
                    <FontAwesomeIcon icon={faXmark} />
                </div>
            </div>
        </div>
    );
}
