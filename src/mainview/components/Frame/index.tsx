import {
    faEllipsis,
    faMinus,
    faXmark,
} from "@fortawesome/free-solid-svg-icons";
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

const openDevTools = () => {
    if (window.api) {
        window.api.rpc.request.openDevTools();
    }
};

export default function Frame() {
    return (
        <div className="w-full h-[5%] pt-1 px-1">
            <div className="w-full h-full flex flex-row items-center justify-between electrobun-webkit-app-region-drag">
                <div className="w-1/10 flex flex-row items-center px-4">
                    <div
                        onClick={openDevTools}
                        className="cursor-default hover:cursor-pointer hover:bg-zinc-500 rounded-full px-0.5"
                    >
                        <FontAwesomeIcon icon={faEllipsis} />
                    </div>
                </div>

                <div className="w-8/10 h-full bg-zinc-700 rounded-4xl flex flex-row items-center justify-between px-4 electrobun-webkit-app-region-no-drag">
                    <ControlPanel />
                    <ControlPages />
                    <Settings />
                </div>

                <div className="w-1/10 flex flex-row-reverse items-center px-4 electrobun-webkit-app-region-no-drag">
                    <div
                        onClick={close}
                        className="cursor-default hover:cursor-pointer hover:bg-zinc-500 hover:text-red-500 rounded-full px-0.5"
                    >
                        <FontAwesomeIcon icon={faXmark} />
                    </div>
                    <div
                        onClick={minimize}
                        className="cursor-default hover:cursor-pointer hover:bg-zinc-500 rounded-full px-0.5"
                    >
                        <FontAwesomeIcon icon={faMinus} />
                    </div>
                </div>
            </div>
        </div>
    );
}
