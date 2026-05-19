import { goto } from "@/mainview/utils/url.ts";
import { usePlayerState } from "@/mainview/context/PlayerContext.tsx";

export default function DataUI() {
    const { currentTrack } = usePlayerState();

    if (!currentTrack || !currentTrack.id) {
        return (
            <div className="flex flex-row items-center ml-3.75 w-1/6">
                <div className="currently-playing ml-1.25 cursor-default select-none flex flex-col">
                    <span className="text-sm">Not playing</span>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-row items-center ml-3.75 w-1/6">
            <span>
                {currentTrack.thumbnail && (
                    <img
                        src={currentTrack.thumbnail}
                        alt=""
                        height={50}
                        width={50}
                        className="rounded-lg"
                    />
                )}
            </span>
            <div className="currently-playing ml-1.25 cursor-default select-none flex flex-col">
                <span
                    className="text-sm hover:underline hover:cursor-pointer truncate"
                    onClick={() => goto(`/track/${currentTrack.source}/${currentTrack.id}`)}
                >
                    {currentTrack.title?.slice(0, 30)}
                </span>
                {currentTrack.artist && <span className="text-sm">{currentTrack.artist}</span>}
            </div>
        </div>
    );
}
