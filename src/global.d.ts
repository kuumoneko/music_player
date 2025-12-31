export { };

declare global {
    interface Window {
        electronAPI: {
            api: (mode: string, data: any) => Promise<{ ok: boolean, data: any }>;
        };
    }
}