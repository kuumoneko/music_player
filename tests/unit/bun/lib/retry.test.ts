import { describe, expect, test } from "bun:test";
import { isNetworkError, withRetry, type RetryInfo } from "../../../../src/bun/lib/retry.ts";

describe("isNetworkError", () => {
    test("returns false for nullish and primitive non-errors", () => {
        expect(isNetworkError(null)).toBe(false);
        expect(isNetworkError(undefined)).toBe(false);
        expect(isNetworkError(42)).toBe(false);
    });

    test("detects network codes in string errors", () => {
        for (const message of ["ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "fetch failed", "socket hang up"]) {
            expect(isNetworkError(message)).toBe(true);
        }
    });

    test("detects network codes on error objects", () => {
        expect(isNetworkError(Object.assign(new Error("boom"), { code: "ECONNREFUSED" }))).toBe(true);
        expect(isNetworkError(Object.assign(new Error("boom"), { errno: "EAI_AGAIN" }))).toBe(true);
        expect(isNetworkError(Object.assign(new Error("boom"), { code: 0 }))).toBe(true);
    });

    test("detects transport failures surfaced as TypeError", () => {
        expect(isNetworkError(new TypeError("Failed to fetch"))).toBe(true);
    });

    test("detects HTTP status 0 but not real HTTP failures", () => {
        expect(isNetworkError({ status: 0 })).toBe(true);
        expect(isNetworkError({ response: { status: 0 } })).toBe(true);
        expect(isNetworkError({ status: 503 })).toBe(false);
        expect(isNetworkError({ status: 404 })).toBe(false);
    });

    test("detects abort and timeout errors", () => {
        expect(isNetworkError(Object.assign(new Error("x"), { name: "AbortError" }))).toBe(true);
        expect(isNetworkError(Object.assign(new Error("x"), { name: "TimeoutError" }))).toBe(true);
    });

    test("walks nested causes", () => {
        expect(isNetworkError(new Error("wrapped", { cause: new Error("ECONNRESET") }))).toBe(true);
    });

    test("rejects ordinary application errors", () => {
        expect(isNetworkError(new Error("invalid input"))).toBe(false);
        expect(isNetworkError({ code: "ERR_INVALID_ARG" })).toBe(false);
    });
});

describe("withRetry", () => {
    test("returns the first successful result without retrying", async () => {
        let calls = 0;
        const value = await withRetry(async () => {
            calls++;
            return "ok";
        }, { baseDelayMs: 0, jitter: 0 });
        expect(value).toBe("ok");
        expect(calls).toBe(1);
    });

    test("retries until the operation succeeds", async () => {
        let calls = 0;
        const value = await withRetry(async (attempt) => {
            calls++;
            if (attempt < 3) throw new Error("transient");
            return attempt;
        }, { attempts: 3, baseDelayMs: 0, jitter: 0, isRetryable: () => true });
        expect(value).toBe(3);
        expect(calls).toBe(3);
    });

    test("rethrows the last error once the attempt budget is spent", async () => {
        let calls = 0;
        await expect(withRetry(async () => {
            calls++;
            throw new Error(`boom ${calls}`);
        }, { attempts: 2, baseDelayMs: 0, jitter: 0, isRetryable: () => true })).rejects.toThrow("boom 2");
        expect(calls).toBe(2);
    });

    test("does not retry non-retryable errors by default", async () => {
        let calls = 0;
        await expect(withRetry(async () => {
            calls++;
            throw new Error("invalid input");
        }, { baseDelayMs: 0, jitter: 0 })).rejects.toThrow("invalid input");
        expect(calls).toBe(1);
    });

    test("reports each retry through onRetry", async () => {
        const infos: RetryInfo[] = [];
        await withRetry(async (attempt) => {
            if (attempt === 1) throw new Error("first");
            return "done";
        }, {
            attempts: 2,
            baseDelayMs: 0,
            jitter: 0,
            isRetryable: () => true,
            onRetry: (info) => {
                infos.push(info);
            },
        });
        expect(infos).toHaveLength(1);
        expect(infos[0]?.attempt).toBe(1);
        expect(infos[0]?.waitingForNetwork).toBe(false);
        expect(infos[0]?.delayMs).toBe(0);
    });

    test("treats attempts below one as a single attempt", async () => {
        let calls = 0;
        await expect(withRetry(async () => {
            calls++;
            throw new Error("nope");
        }, { attempts: 0, baseDelayMs: 0, jitter: 0, isRetryable: () => true })).rejects.toThrow("nope");
        expect(calls).toBe(1);
    });

    test("throws immediately when the signal is already aborted", async () => {
        const controller = new AbortController();
        controller.abort();
        let calls = 0;
        await expect(withRetry(async () => {
            calls++;
            return "never";
        }, { signal: controller.signal })).rejects.toThrow("Operation aborted");
        expect(calls).toBe(0);
    });

    test("aborts while waiting between attempts", async () => {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), 5);
        await expect(withRetry(async () => {
            throw new Error("retry me");
        }, {
            attempts: 3,
            baseDelayMs: 200,
            jitter: 0,
            isRetryable: () => true,
            signal: controller.signal,
        })).rejects.toThrow("Operation aborted");
    });
});
