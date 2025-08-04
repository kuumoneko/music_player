// src/components/Player.tsx
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDatabase } from '@fortawesome/free-solid-svg-icons';
import { goto } from '../../utils/url.ts';
import DataUI from "./components/data/index.tsx";
import VolumeUI from "./components/volume/index.tsx";
import SleepUI from "./components/sleep/index.tsx"
import PlayerUI from './components/player/index.tsx';

export default function Player({
    url, seturl
}: { url: string, seturl: (a: string) => void }) {


    return (
        <div className="player h-[35%] w-[90%] bg-slate-200 dark:bg-slate-700 text-black dark:text-white mt-[15px] rounded-xl flex justify-between items-center px-[5px] m-0 select-none" >
            <DataUI seturl={seturl} />

            <div className='flex flex-col items-center'>
                <PlayerUI />
            </div>
            <div className="volume group flex flex-row mr-[10px] cursor-pointer select-none">
                <SleepUI />

                <span className='mr-[10px]' onClick={() => {
                    goto("/queue/play", seturl)
                }}>
                    <FontAwesomeIcon icon={faDatabase} />
                </span>
                <VolumeUI />
            </div>
        </div>
    );
}

