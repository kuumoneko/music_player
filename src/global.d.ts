export { };

declare global {
    interface Window {
        electronAPI: {
            api: (mode: string, data: any) => Promise<{ ok: boolean, data: any }>;
            close: () => void,
            minimize: () => void,
            maximize: () => void
        },
        discord: {
            setmusic: (track: Track) => Promise<{ ok: boolean }>;
            clearmusic: () => Promise<{ ok: boolean }>;
        }
    }
}