import { writeLogs } from "../db/index.ts";

/**
 * On-demand network monitor.
 *
 * When everything is healthy this module does nothing at all — no polling, no
 * timers, no sockets. As soon as a caller reports a network failure we flip to
 * "offline" and start a lightweight probe loop that runs ONLY while the failure
 * is outstanding. The first successful probe flips the state back to "online"
 * and notifies every listener immediately.
 */

export type NetworkState = "online" | "offline";

const PROBE_URLS = [
    "https://www.gstatic.com/generate_204",
    "https://1.1.1.1/",
];

const PROBE_TIMEOUT_MS = 3_000;
const PROBE_INTERVAL_MS = 2_000;

let state: NetworkState = "online";
let probeTimer: ReturnType<typeof setTimeout> | null = null;
let probeInFlight = false;

const restoredListeners = new Set<() => void>();

export function getNetworkState(): NetworkState {
    return state;
}

/**
 * Subscribe to network-restoration events. Returns an unsubscribe function.
 * The callback is not invoked for the initial (already online) state.
 */
export function onNetworkRestored(cb: () => void): () => void {
    restoredListeners.add(cb);
    return () => {
        restoredListeners.delete(cb);
    };
}

async function probeOnce(): Promise<boolean> {
    for (const url of PROBE_URLS) {
        try {
            const res = await fetch(url, {
                method: "GET",
                signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
            });
            // Any HTTP response means the network path is alive again.
            if (res.status > 0) return true;
        } catch {
            // try the next probe target
        }
    }
    return false;
}

function stopProbing() {
    if (probeTimer) {
        clearTimeout(probeTimer);
        probeTimer = null;
    }
}

function notifyRestored() {
    const listeners = [...restoredListeners];
    for (const listener of listeners) {
        try {
            listener();
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            writeLogs([{ type: "error", message: `network: restored listener failed: ${message}` }]);
        }
    }
}

function markOnline(reason: string) {
    if (state === "online") {
        stopProbing();
        return;
    }
    state = "online";
    stopProbing();
    writeLogs([{ type: "info", message: `network: online (${reason})` }]);
    notifyRestored();
}

function startProbing() {
    if (probeTimer || state === "online") return;

    const tick = async () => {
        probeTimer = null;
        if (state === "online") return;
        if (!probeInFlight) {
            probeInFlight = true;
            let ok = false;
            try {
                ok = await probeOnce();
            } catch {
                ok = false;
            } finally {
                probeInFlight = false;
            }
            if (ok) {
                markOnline("probe succeeded");
                return;
            }
        }
        if (state === "offline" && !probeTimer) {
            probeTimer = setTimeout(tick, PROBE_INTERVAL_MS);
        }
    };

    // Probe right away, then keep probing while the failure is outstanding.
    probeTimer = setTimeout(tick, 0);
}

/**
 * Report that a network operation failed. Starts the probe loop when this is
 * the first observation of the outage; subsequent reports are cheap no-ops.
 */
export function reportNetworkFailure(): void {
    if (state === "offline") return;
    state = "offline";
    writeLogs([{ type: "info", message: "network: offline — probing until restored" }]);
    startProbing();
}

/**
 * Report that a network operation succeeded. Stops probing and notifies
 * listeners immediately if we were offline.
 */
export function reportNetworkSuccess(): void {
    markOnline("operation succeeded");
}

export interface WaitForNetworkOptions {
    timeoutMs?: number;
    signal?: AbortSignal;
}

/**
 * Resolve `true` as soon as the network is online again, `false` on timeout or
 * abort. Resolves immediately when already online.
 */
export function waitForNetworkRestored(options: WaitForNetworkOptions = {}): Promise<boolean> {
    if (state === "online") return Promise.resolve(true);

    const { timeoutMs, signal } = options;
    return new Promise<boolean>((resolve) => {
        let settled = false;
        let timer: ReturnType<typeof setTimeout> | null = null;
        let unsubscribe: () => void = () => { };

        const cleanup = () => {
            unsubscribe();
            if (timer) {
                clearTimeout(timer);
                timer = null;
            }
            signal?.removeEventListener("abort", onAbort);
        };

        const finish = (value: boolean) => {
            if (settled) return;
            settled = true;
            cleanup();
            resolve(value);
        };

        const onAbort = () => finish(false);

        unsubscribe = onNetworkRestored(() => finish(true));
        if (typeof timeoutMs === "number" && timeoutMs > 0) {
            timer = setTimeout(() => finish(false), timeoutMs);
        }

        if (signal) {
            if (signal.aborted) {
                finish(false);
                return;
            }
            signal.addEventListener("abort", onAbort, { once: true });
        }
    });
}
