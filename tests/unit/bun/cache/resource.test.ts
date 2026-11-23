import { describe, expect, test } from "bun:test";
import { Resource, type ResourceState } from "../../../../src/bun/cache/resource.ts";

async function waitFor(predicate: () => boolean, timeoutMs = 500): Promise<void> {
    const startedAt = Date.now();
    while (!predicate()) {
        if (Date.now() - startedAt > timeoutMs) throw new Error("waitFor timed out");
        await Bun.sleep(5);
    }
}

describe("Resource first load", () => {
    test("loads partial data and returns it", async () => {
        let partialCalls = 0;
        const resource = new Resource<number[]>({
            key: "first-load",
            ttl: 60_000,
            loadPartial: async () => {
                partialCalls++;
                return { data: [1, 2], complete: false };
            },
            loadFull: async () => ({ data: [1, 2, 3] }),
        });

        expect(await resource.get()).toEqual([1, 2]);
        expect(partialCalls).toBe(1);
    });

    test("returns an empty array when the partial load fails", async () => {
        const resource = new Resource<number[]>({
            key: "partial-failure",
            ttl: 60_000,
            loadPartial: async () => null,
            loadFull: async () => null,
        });

        expect(await resource.get()).toEqual([]);
    });

    test("persists a complete first load", async () => {
        let persisted: ResourceState<number[]> | null = null;
        const resource = new Resource<number[]>({
            key: "persist-first",
            ttl: 60_000,
            loadPartial: async () => ({ data: [7], complete: true }),
            loadFull: async () => null,
            persist: (state) => {
                persisted = state;
            },
        });

        expect(await resource.get()).toEqual([7]);
        expect((persisted as ResourceState<number[]> | null)?.data).toEqual([7]);
        expect((persisted as ResourceState<number[]> | null)?.complete).toBe(true);
    });

    test("swallows persistence failures", async () => {
        const resource = new Resource<number[]>({
            key: "persist-failure",
            ttl: 60_000,
            loadPartial: async () => ({ data: [1], complete: true }),
            loadFull: async () => null,
            persist: () => {
                throw new Error("disk full");
            },
        });

        await expect(resource.get()).resolves.toEqual([1]);
    });
});

describe("Resource persisted state", () => {
    test("serves a fresh complete state without touching the network", async () => {
        let partialCalls = 0;
        const resource = new Resource<number[]>({
            key: "fresh-cache",
            ttl: 60_000,
            loadPartial: async () => {
                partialCalls++;
                return { data: [9] };
            },
            loadFull: async () => ({ data: [9] }),
            loadPersisted: () => ({ data: [1, 2], at: Date.now(), complete: true }),
        });

        expect(await resource.get()).toEqual([1, 2]);
        await Bun.sleep(10);
        expect(partialCalls).toBe(0);
    });

    test("revalidates a stale complete state with its etag", async () => {
        let partialCalls = 0;
        let seenEtag: string | undefined;
        let fullCalls = 0;
        const resource = new Resource<number[]>({
            key: "stale-cache",
            ttl: 1,
            loadPartial: async (etag) => {
                partialCalls++;
                seenEtag = etag;
                return { data: [], notModified: true };
            },
            loadFull: async () => {
                fullCalls++;
                return { data: [3] };
            },
            loadPersisted: () => ({
                data: [1],
                at: Date.now() - 10_000,
                complete: true,
                etag: "etag-1",
            }),
        });

        expect(await resource.get()).toEqual([1]);
        await waitFor(() => partialCalls === 1);
        expect(seenEtag).toBe("etag-1");
        expect(fullCalls).toBe(0);
    });

    test("completes an incomplete state in the background and emits", async () => {
        let fullCalls = 0;
        let emitted = 0;
        let persisted: ResourceState<number[]> | null = null;
        const resource = new Resource<number[]>({
            key: "incomplete-cache",
            ttl: 60_000,
            loadPartial: async () => ({ data: [1], complete: false }),
            loadFull: async () => {
                fullCalls++;
                return { data: [1, 2] };
            },
            loadPersisted: () => ({ data: [1], at: Date.now(), complete: false }),
            persist: (state) => {
                persisted = state;
            },
            emit: () => {
                emitted++;
            },
        });

        expect(await resource.get()).toEqual([1]);
        await waitFor(() => emitted === 1);

        expect(fullCalls).toBe(1);
        expect((persisted as ResourceState<number[]> | null)?.data).toEqual([1, 2]);
        expect(await resource.get()).toEqual([1, 2]);
    });

    test("keeps the partial state when the full load fails", async () => {
        let emitted = 0;
        const resource = new Resource<number[]>({
            key: "full-failure",
            ttl: 60_000,
            loadPartial: async () => ({ data: [1], complete: false }),
            loadFull: async () => null,
            loadPersisted: () => ({ data: [1], at: Date.now(), complete: false }),
            emit: () => {
                emitted++;
            },
        });

        expect(await resource.get()).toEqual([1]);
        await Bun.sleep(20);
        expect(emitted).toBe(0);
        expect(await resource.get()).toEqual([1]);
    });
});

describe("Resource concurrency and invalidation", () => {
    test("deduplicates concurrent first loads", async () => {
        let calls = 0;
        const resource = new Resource<number[]>({
            key: "dedupe",
            ttl: 0,
            loadPartial: async () => {
                calls++;
                await Bun.sleep(20);
                return { data: [1], complete: true };
            },
            loadFull: async () => null,
        });

        const results = await Promise.all([resource.get(), resource.get(), resource.get()]);
        expect(results).toEqual([[1], [1], [1]]);
        expect(calls).toBe(1);
    });

    test("serves the cached value on repeated reads", async () => {
        let calls = 0;
        const resource = new Resource<string[]>({
            key: "repeat-reads",
            ttl: 60_000,
            loadPartial: async () => {
                calls++;
                return { data: ["x"], complete: true };
            },
            loadFull: async () => null,
        });

        await resource.get();
        await resource.get();
        expect(calls).toBe(1);
    });

    test("invalidate forces the next read to reload", async () => {
        let calls = 0;
        const resource = new Resource<string[]>({
            key: "invalidate",
            ttl: 60_000,
            loadPartial: async () => {
                calls++;
                return { data: ["x"], complete: true };
            },
            loadFull: async () => null,
        });

        await resource.get();
        resource.invalidate();
        await resource.get();
        expect(calls).toBe(2);
    });

    test("invalidate can clear persisted state", async () => {
        let cleared = 0;
        const resource = new Resource<string[]>({
            key: "invalidate-persisted",
            ttl: 60_000,
            loadPartial: async () => ({ data: ["x"], complete: true }),
            loadFull: async () => null,
            clearPersisted: () => {
                cleared++;
            },
        });

        resource.invalidate(true);
        expect(cleared).toBe(1);
    });
});
