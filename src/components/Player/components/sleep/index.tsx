import { useState } from "react";
import { sleep_types } from "../../common/types/index.ts";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBed } from "@fortawesome/free-solid-svg-icons";



export default function SleepUI() {

    const sleep_type = ["nosleep", "after 5 minutes", "after 10 minutes", "after 15 minutes", "after 30 minutes", "after 45 minutes", "after 1 hours", "end of this track"];
    const [sleep, setsleep] = useState(sleep_types.no);


    const Sleep_comp = () => {
        switch (sleep) {
            case sleep_types.no:
                return <span className="w-[100%] flex flex-row-reverse">none</span>;
            case sleep_types.five:
                return <span className="w-[100%] flex flex-row-reverse">5</span>;
            case sleep_types.ten:
                return <span className="w-[100%] flex flex-row-reverse">10</span>;
            case sleep_types.tenfive:
                return <span className="w-[100%] flex flex-row-reverse">15</span>;
            case sleep_types.threeten:
                return <span className="w-[100%] flex flex-row-reverse">30</span>;
            case sleep_types.fourfive:
                return <span className="w-[100%] flex flex-row-reverse">45</span>;
            case sleep_types.hour:
                return <span className="w-[100%] flex flex-row-reverse">1 hour</span>;
            default:
                return <span className="w-[100%] flex flex-row-reverse">End</span>;
        }
    }

    return (
        <span className='flex flex-row'>
            <span className='w-[60px]  mr-[5px] flex flex-row-reverse'>
                <Sleep_comp />
            </span>
            <span className='mr-[10px]'
                onClick={() => {
                    const index = sleep_type.indexOf(sleep);
                    let kill_time: string | number = new Date().getTime();
                    const temp = sleep_type[(index + 1) % sleep_type.length] as sleep_types
                    switch (temp) {
                        case sleep_types.no:
                            kill_time = sleep_types.no
                            break;
                        case sleep_types.five:
                            kill_time += 30 * 1000
                            break;
                        case sleep_types.ten:
                            kill_time += 10 * 60 * 1000
                            break;
                        case sleep_types.tenfive:
                            kill_time += 15 * 60 * 1000
                            break;
                        case sleep_types.threeten:
                            kill_time += 30 * 60 * 1000
                            break;
                        case sleep_types.fourfive:
                            kill_time += 45 * 60 * 1000
                            break;
                        case sleep_types.hour:
                            kill_time += 60 * 60 * 1000
                            break;
                        default:
                            kill_time = "end of this track"
                    }
                    localStorage.setItem("kill time", String(kill_time))
                    setsleep(temp);
                }}
            >
                <FontAwesomeIcon icon={faBed} />
            </span>
        </span>
    )

}