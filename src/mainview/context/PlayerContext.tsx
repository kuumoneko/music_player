import {
    createContext,
    useContext,
    useEffect,
    useState,
    ReactNode,
} from "react";
import { Shuffle, Repeat, Track } from "@/shared/types.ts";

export interface PlayerState {
    isPlaying: boolean;
    time: number;
    duration: number;
    isLived: boolean;
    isLoading: boolean;
    currentTrack: {
        source: string;
        id: string;
        title: string;
        thumbnail: string;
        artist: string;
    } | null;
    shuffle: Shuffle;
    repeat: Repeat;
    volume: number;
    playQueue: Track[];
    nextfrom: string;
    playedTrack: string[];
}

const defaultState: PlayerState = {
    isPlaying: false,
    time: 0,
    duration: 0,
    isLived: false,
    isLoading: true,
    currentTrack: null,
    shuffle: Shuffle.Disable,
    repeat: Repeat.Disable,
    volume: 50,
    playQueue: [],
    nextfrom: "",
    playedTrack: [],
};

const PlayerContext = createContext<PlayerState>(defaultState);

export function PlayerProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<PlayerState>(defaultState);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const [
                    playingData,
                    currentPlaying,
                    volume,
                    playQueue,
                    nextfrom,
                ] = await Promise.all([
                    window.api.rpc.request.getPlayingData(),
                    window.api.rpc.request.getUserData("currentPlaying"),
                    window.api.rpc.request.getUserData("volume"),
                    window.api.rpc.request.getUserData("playQueue"),
                    window.api.rpc.request.getUserData("nextfrom"),
                ]);

                const queue = (await window.api.rpc.request.getQueueData(
                    playQueue,
                )) as Track[];

                if (cancelled) return;
                setState({
                    isPlaying: playingData.isPlaying,
                    time: playingData.current.time,
                    duration: playingData.current.duration,
                    isLived: playingData.current.isLived,
                    isLoading: playingData.isLoading,
                    shuffle: playingData.shuffle,
                    repeat: playingData.repeat,
                    playedTrack: playingData.playedTrack,
                    currentTrack: currentPlaying || null,
                    volume: volume ?? 50,
                    playQueue: queue ?? [],
                    nextfrom: nextfrom ?? "",
                });
            } catch (err) {
                window.api.rpc.request.sendError(err);
            }
        })();

        const handlers: Record<string, (payload: any) => void> = {
            timeUpdate: (payload) => {
                setState((prev) => ({
                    ...prev,
                    time: payload.time,
                    isPlaying: payload.isPlaying,
                }));
            },
            playerStateChange: (payload) => {
                setState((prev) => ({ ...prev, ...payload }));
            },
            currentTrackChanged: (payload) => {
                setState((prev) => ({ ...prev, currentTrack: payload }));
            },
            settingsChanged: (payload) => {
                setState((prev) => ({ ...prev, ...payload }));
            },
            queueChanged: (payload) => {
                setState((prev) => ({
                    ...prev,
                    playQueue: payload.playQueue,
                    nextfrom: payload.nextfrom,
                    playedTrack: payload.playedTrack,
                }));
            },
        };

        for (const [name, handler] of Object.entries(handlers)) {
            window.api.rpc.addMessageListener(name, handler);
        }

        return () => {
            cancelled = true;
            for (const [name, handler] of Object.entries(handlers)) {
                window.api.rpc.removeMessageListener(name, handler);
            }
        };
    }, []);

    return (
        <PlayerContext.Provider value={state}>
            {children}
        </PlayerContext.Provider>
    );
}

export function usePlayerState() {
    return useContext(PlayerContext);
}
