import { Updater } from "electrobun";

export default async function getMainViewUrl(): Promise<boolean> {
    const DEV_SERVER_URL = `http://localhost:${process.env["VITE_PORT"] ?? 5173}`;

    const channel = await Updater.localInfo.channel();
    if (channel === "dev") {
        try {
            await fetch(DEV_SERVER_URL, { method: "HEAD" });
            console.log(`HMR enabled: Using Vite dev server at ${DEV_SERVER_URL}`);
            return true;
        } catch {
            console.log(
                "Vite dev server not running. Run 'bun run dev:hmr' for HMR support.",
            );
        }
    }

    return false
}