import { createRoot } from "react-dom/client";
import { Component, ReactNode } from "react";
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
            return async (...args: unknown[]) => {
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
class ErrorBoundary extends Component<{ children: ReactNode }> {
    componentDidCatch(error: Error) {
        window.api.rpc.request.sendError(error);
    }
    render() {
        return this.props.children;
    }
}

createRoot(document.getElementById("root")!).render(
    <ErrorBoundary>
        <App />
    </ErrorBoundary>,
);
