import { getNetworkState, reportNetworkFailure, reportNetworkSuccess, waitForNetworkRestored } from "./network.ts";

/**
 * Shared retry helper with network awareness.
 *
 * While the process is known to be offline the helper parks the operation and
 * waits for the network monitor to report restoration instead of burning the
 * attempt budget on guaranteed failures.
 */

export interface RetryInfo {
    attempt: number;
    error: unknown;
    delayMs: number;
    waitingForNetwork: boolean;
}

export interface RetryOptions {
    /** Total attempts, including the first one. Defaults to 3. */
    attempts?: number;
    /** Delay before the first retry. Defaults to 500ms. */
    baseDelayMs?: number;
    /** Multiplier applied to the delay after every retry. Defaults to 2. */
    factor?: number;
    /** Random +/- fraction applied to each delay (0..1). Defaults to 0.2. */
    jitter?: number;
    /** How often one call may park on an outage before giving up. Defaults to 5. */
    maxNetworkWaits?: number;
    /** Decides whether an error is worth retrying. Defaults to isNetworkError. */
    isRetryable?: (error: unknown, attempt: number) => boolean;
    /** Called before each wait/retry. May be async. */
    onRetry?: (info: RetryInfo) => void | Promise<void>;
    /** Cancels waits and prevents any further attempts. */
    signal?: AbortSignal;
}

const NETWORK_CODE_RE = /ECONNRESET|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|ENETUNREACH|EHOSTUNREACH|ENETDOWN|EPIPE|UND_ERR|socket hang up/i;
const NETWORK_MESSAGE_RE = /fetch failed|network (error|request|is down)|offline|connection (reset|refused|closed|aborted)|timed? ?out|getaddrinfo|dns lookup|temporary failure in name resolution/i;

interface ErrorLike {
    name?: string;
    code?: string | number;
    errno?: string | number;
    status?: number;
    statusCode?: number;
    response?: { status?: number };
    cause?: ErrorLike;
    message?: string;
}

export function isNetworkError(err: unknown): boolean {
    if (err === null || err === undefined) return false;

    if (typeof err === "string") {
        return NETWORK_CODE_RE.test(err) || NETWORK_MESSAGE_RE.test(err);
    }

    if (typeof err !== "object") return false;

    const anyErr = err as ErrorLike;

    if (anyErr.name === "AbortError" || anyErr.name === "TimeoutError") return true;

    const code = anyErr.code ?? anyErr.errno ?? anyErr.cause?.code;
    if (typeof code === "string" && NETWORK_CODE_RE.test(code)) return true;
    if (typeof code === "number" && code === 0) return true;

    const status = anyErr.status ?? anyErr.statusCode ?? anyErr.response?.status;
    if (status === 0) return true;

    // Undici/Bun surface transport failures as `fetch` TypeErrors.
    if (err instanceof TypeError) return true;

    if (anyErr.cause && typeof anyErr.cause === "object") {
        if (isNetworkError(anyErr.cause)) return true;
    }

    const message = typeof anyErr.message === "string" ? anyErr.message : "";
    return NETWORK_CODE_RE.test(message) || NETWORK_MESSAGE_RE.test(message);
}

function abortError(): Error {
    const err = new Error("Operation aborted");
    err.name = "AbortError";
    return err;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
    if (ms <= 0) {
        return signal?.aborted ? Promise.reject(abortError()) : Promise.resolve();
    }
    return new Promise<void>((resolve, reject) => {
        let settled = false;
        const cleanup = () => {
            clearTimeout(timer);
            signal?.removeEventListener("abort", onAbort);
        };
        const finish = (err?: Error) => {
            if (settled) return;
            settled = true;
            cleanup();
            if (err) reject(err);
            else resolve();
        };
        const onAbort = () => finish(abortError());
        const timer = setTimeout(() => finish(), ms);

        if (signal?.aborted) {
            finish(abortError());
            return;
        }
        signal?.addEventListener("abort", onAbort, { once: true });
    });
}

export async function withRetry<T>(fn: (attempt: number) => Promise<T>, options: RetryOptions = {}): Promise<T> {
    const attempts = Math.max(1, Math.floor(options.attempts ?? 3));
    const baseDelayMs = Math.max(0, options.baseDelayMs ?? 500);
    const factor = options.factor ?? 2;
    const jitter = Math.min(1, Math.max(0, options.jitter ?? 0.2));
    const maxNetworkWaits = Math.max(0, Math.floor(options.maxNetworkWaits ?? 5));
    const signal = options.signal;

    let attempt = 1;
    let networkWaits = 0;

    for (; ;) {
        if (signal?.aborted) throw abortError();

        try {
            const value = await fn(attempt);
            reportNetworkSuccess();
            return value;
        } catch (error) {
            if (signal?.aborted) throw abortError();

            const retryable = options.isRetryable
                ? options.isRetryable(error, attempt)
                : isNetworkError(error);
            if (!retryable || attempt >= attempts) throw error;

            const networkError = isNetworkError(error);
            if (networkError) reportNetworkFailure();

            // A known outage would fail instantly over and over — park instead
            // of consuming attempts until connectivity is back.
            if (networkError && getNetworkState() === "offline" && networkWaits < maxNetworkWaits) {
                networkWaits++;
                await options.onRetry?.({ attempt, error, delayMs: 0, waitingForNetwork: true });
                const restored = await waitForNetworkRestored({ signal });
                if (!restored) throw error;
                if (signal?.aborted) throw abortError();
                continue; // same attempt number: the budget is not consumed
            }

            const variance = 1 + (Math.random() * 2 - 1) * jitter;
            const delayMs = Math.max(0, Math.round(baseDelayMs * Math.pow(factor, attempt - 1) * variance));

            await options.onRetry?.({ attempt, error, delayMs, waitingForNetwork: false });
            await sleep(delayMs, signal);
            attempt++;
        }
    }
}
