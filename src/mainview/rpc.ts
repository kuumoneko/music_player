import { Electroview } from "electrobun/view";

export default function setup() {
    const AppRPC = Electroview.defineRPC({
        maxRequestTime: 60000,
        handlers: {
            requests: {
                test: ({ a, b }) => { return a + b; }
            },
        }
    }
    )

    window.api = new Electroview({ rpc: AppRPC }) as any;
}