import Sidebar from '../common/components/Sidebar/index.tsx';
import Home from './home/index.tsx';
import Player from '../common/components/Player/index.tsx';

export default function MainContent({ url, seturl }: { url: string, seturl: (a: string) => void }) {
    return (
        <div className="main-content flex flex-col justify-between items-center h-[100%] w-screen mt-5 p-0">
            <div className="top h-[80%] w-[100%] flex flex-row justify-evenly">
                <Sidebar seturl={seturl} />
                <Home url={url} seturl={seturl} />
            </div>
            <div className="bottom h-[20%] w-[100%] flex justify-center">
                <Player url={url} seturl={seturl} />
            </div>
        </div>
    );
}