import { faMinus, faXmark } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import ControlPanel from "./Controls";
import ControlPages from "./Pages";
import Settings from "./Settings";

const minimize = () => {
    if (window.api) {
        window.api.rpc.request.minimize();
    }
};

const close = () => {
    if (window.api) {
        window.api.rpc.request.close();
    }
};

export default function Frame() {
    return (
        <div className="h-[5%] w-full flex flex-row items-center justify-between">
            <div className="w-10"></div>

            <div className="w-[80%] h-full bg-slate-700 rounded-4xl flex flex-row items-center justify-between px-4">
                <ControlPanel />
                <ControlPages />
                <Settings />
            </div>

            <div className="w-20 flex flex-row items-center justify-between px-4">
                <div
                    onClick={minimize}
                    className="cursor-default hover:cursor-pointer hover:bg-slate-500 rounded-full px-0.5"
                >
                    <FontAwesomeIcon icon={faMinus} />
                </div>
                <div
                    onClick={close}
                    className="cursor-default hover:cursor-pointer hover:bg-slate-500 rounded-full px-0.5"
                >
                    <FontAwesomeIcon icon={faXmark} />
                </div>
            </div>
        </div>
    );
}
