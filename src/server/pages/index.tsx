import Sidebar from '../common/components/Sidebar/index.tsx';
import Home from './home/index.tsx';
import Player from '../common/components/Player/index.tsx';
import Test_player from '../common/components/Player/test.tsx';

export default function MainContent({ url, seturl }: { url: string, seturl: (a: string) => void }) {
    return (
        <div className="main-content flex flex-col justify-between items-center h-[90%] w-[100vw] mt-5 p-0">
            <div className="top flex flex-row justify-center h-[80%] w-[100vw] items-start">
                <Sidebar url={url} seturl={seturl} />
                <Home url={url} seturl={seturl} />
            </div>
            <div className="bottom h-[20%] w-[100%] flex justify-center">
                <Player url={url} seturl={seturl} />
            </div>
        </div>
    );
}