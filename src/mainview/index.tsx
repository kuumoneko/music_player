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

createRoot(document.getElementById("root")!).render(<App />);
