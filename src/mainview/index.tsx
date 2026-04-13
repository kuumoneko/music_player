import { createRoot } from "react-dom/client";
import { Electroview } from "electrobun/view";

// @ts-ignore
import "./index.css";
import App from "./view";

// ts-ignore
const rpc = Electroview.defineRPC({
    maxRequestTime: 60 * 1000,
    handlers: {
        requests: {},
    },
});

window.api = new Electroview({ rpc: rpc }) as any;

const originalRequestObj = window.api.rpc.request;

window.api.rpc.request = new Proxy(originalRequestObj, {
    get(target, prop) {
        const originalMethod = target[prop];

        if (typeof originalMethod === "function") {
            return async (...args: any[]) => {
                const rawResponse = await originalMethod.apply(target, args);

                try {
                    if (typeof rawResponse === "string") {
                        return JSON.parse(decodeURIComponent(rawResponse));
                    }
                    return rawResponse;
                } catch (error) {
                    return rawResponse;
                }
            };
        }

        return originalMethod;
    },
});

try {
    createRoot(document.getElementById("root")!).render(<App />);
} catch (error) {
    window.api.rpc.request.sendError(error);
}
