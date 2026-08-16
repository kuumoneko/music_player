import { INNERTUBE_CLIENT_VERSION, INNERTUBE_USER_AGENT } from "../../../shared/constants.ts";
import { getUserData, writeLogs, writeUserData } from "../../db/index.ts";

const YT_HOME = "https://www.youtube.com";
const YT_API_BASE = "https://www.youtube.com/youtubei/v1";

export interface YtSessionData {
    apiKey: string;
    clientVersion: string;
    visitorData: string;
    signatureTimestamp: number;
    cookies: string;
}

class YtSessionManager {
    private apiKey = "";
    private clientVersion = INNERTUBE_CLIENT_VERSION;
    private visitorData = "";
    private signatureTimestamp: number;
    private ready = false;
    private persisted = false;
    private inflight: Promise<YtSessionData> | null = null;

    constructor() {
        this.signatureTimestamp = getUserData("ytSignatureTimestamp") ?? 20584;
    }

    private async resolveApiKey(): Promise<void> {
        if (this.apiKey) return;
        const res = await fetch(YT_HOME, {
            headers: {
                "accept-language": "en-US,en;q=0.9",
                "user-agent": INNERTUBE_USER_AGENT,
            },
            signal: AbortSignal.timeout(10_000),
        });
        const html = await res.text();

        const keyMatch = html.match(/INNERTUBE_API_KEY["']?\s*:\s*["']([^"']+)["']/);
        if (keyMatch) {
            this.apiKey = keyMatch[1];
        } else {
            const cfgMatch = html.match(/ytcfg\.set\s*\(\s*({.+?})\s*\)/s);
            if (cfgMatch) {
                try {
                    const cfg = JSON.parse(cfgMatch[1]);
                    if (typeof cfg.INNERTUBE_API_KEY === "string") this.apiKey = cfg.INNERTUBE_API_KEY;
                } catch {
                    // keep scraping next time
                }
            }
        }

        const versionMatch = html.match(/INNERTUBE_CLIENT_VERSION["']?\s*:\s*["']([^"']+)["']/);
        if (versionMatch) {
            this.clientVersion = versionMatch[1];
        }

        if (!this.apiKey) {
            throw new Error("Could not resolve InnerTube API key from youtube.com");
        }
    }

    private async fetchConfig(): Promise<void> {
        const res = await fetch(`${YT_API_BASE}/config?prettyPrint=false`, {
            method: "POST",
            body: JSON.stringify({
                context: { client: { clientName: "WEB", clientVersion: this.clientVersion, hl: "en", gl: "US" } },
            }),
            headers: { "Content-Type": "application/json" },
            signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) {
            throw new Error(`config endpoint returned ${res.status}`);
        }
        const text = await res.text();
        let data: any;
        try {
            data = JSON.parse(text);
        } catch {
            throw new Error(`config endpoint returned invalid JSON: ${text.substring(0, 200)}`);
        }
        this.visitorData = data?.responseContext?.visitorData || "";
        const fetched = data?.responseContext?.signatureTimestamp;
        if (fetched) {
            this.signatureTimestamp = fetched;
            if (!this.persisted) {
                writeUserData("ytSignatureTimestamp", fetched);
                this.persisted = true;
            }
        }
    }

    async ensure(): Promise<YtSessionData> {
        if (this.ready) {
            return this.snapshot();
        }
        if (!this.inflight) {
            this.inflight = (async () => {
                await this.resolveApiKey();
                try {
                    await this.fetchConfig();
                } catch (e) {
                    const message = e instanceof Error ? e.message : String(e);
                    writeLogs([{ type: "error", message: `YtSession config fetch failed: ${message}` }]);
                }
                this.ready = true;
                return this.snapshot();
            })().finally(() => {
                this.inflight = null;
            });
        }
        return this.inflight;
    }

    invalidate() {
        this.ready = false;
        this.visitorData = "";
    }

    private snapshot(): YtSessionData {
        return {
            apiKey: this.apiKey,
            clientVersion: this.clientVersion,
            visitorData: this.visitorData,
            signatureTimestamp: this.signatureTimestamp,
            cookies: getUserData("ytCookies") ?? "",
        };
    }
}

export const ytSession = new YtSessionManager();
