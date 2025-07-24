import Sidebar from './sidebar/index.tsx';
import Home from './home/index.tsx';
import Player from './player/index.tsx';
// import Player from './player/test.tsx';

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