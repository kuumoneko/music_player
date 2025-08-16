import { faSun, faMoon, faGear } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { goto } from "../../../../utils/url.ts";

export default function Themes(
    {
        theme,
        settheme,
        seturl
    }:
        {
            theme: string,
            settheme: (a: string) => void,
            seturl: (a: string) => void
        }
) {

    return (
        <div className="header-icons flex top-[20px] right-[20px] gap-[15px] items-center cursor-pointer">
            <span className="user-mode h-1/2">
                <div className="flex justify-center items-center space-x-4">
                    <label className="relative inline-block w-[60px] h-8">
                        <input
                            type="checkbox"
                            className="opacity-0 w-0 h-0 peer"
                            checked={theme === 'light'}
                            onChange={() => settheme(theme === 'dark' ? 'light' : 'dark')}
                        />
                        <span className="slider round absolute cursor-pointer top-0 left-0 right-0 bottom-0 bg-gray-300 transition-all duration-400 rounded-[34px] before:absolute before:content-[''] before:h-6 before:w-6 before:left-1 before:bottom-1 before:bg-white before:transition-all before:duration-400 before:rounded-full peer-checked:bg-blue-500 peer-focus:ring-2 peer-focus:ring-blue-500 peer-checked:before:translate-x-6 flex items-center justify-between px-2">
                            <span>
                                <FontAwesomeIcon icon={faSun} />
                            </span>
                            <span>
                                <FontAwesomeIcon icon={faMoon} />
                            </span>
                        </span>
                    </label>
                </div>
            </span>
            <span
                className="material-icons caret-slate-50"
                onClick={() => {
                    goto("/settings", seturl);
                }}
            >
                <FontAwesomeIcon icon={faGear} />
            </span>
        </div>
    )
}