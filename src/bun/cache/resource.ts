import { writeLogs } from "../db/index.ts";

export interface ResourceState<T> {
    data: T;
    etag?: string;
    at: number;
    complete: boolean;
}

export interface ResourceOptions<T> {
    key: string;
    ttl: number;
    loadPartial: (ifNoneMatch?: string) => Promise<{ data: T; etag?: string; notModified?: boolean; complete?: boolean } | null>;
    loadFull: () => Promise<{ data: T; etag?: string } | null>;
    loadPersisted?: () => ResourceState<T> | null;
    persist?: (state: ResourceState<T>) => void;
    clearPersisted?: () => void;
    emit?: () => void;
}

/**
 * Cached resource with lazy-first UX:
 *  - cached/partial data is returned as fast as possible
 *  - the rest is fetched in the background and announced via emit()
 *  - concurrent callers share one job (in-flight dedup)
 *  - etag revalidation: 304 keeps the cache without any network work
 */
export class Resource<T> {
    private readonly options: ResourceOptions<T>;
    private readonly key: string;
    private latest: ResourceState<T> | null;
    private partialJob: Promise<T> | null = null;
    private completing: Promise<void> | null = null;
    private revalidating: Promise<void> | null = null;

    constructor(options: ResourceOptions<T>) {
        this.options = options;
        this.key = options.key;
        this.latest = options.loadPersisted?.() ?? null;
        if (this.latest) {
            writeLogs([{ type: "info", message: `Resource ${this.key}: restored cached state` }]);
        }
    }

    private isFresh(state: ResourceState<T>): boolean {
        return this.options.ttl > 0 && Date.now() - state.at < this.options.ttl;
    }

    async get(): Promise<T> {
        const latest = this.latest;

        if (latest) {
            if (latest.complete) {
                if (this.isFresh(latest)) return latest.data;
                this.kickRevalidate();
                return latest.data;
            }
            if (this.completing) return latest.data;
            this.kickComplete();
            return latest.data;
        }

        if (this.partialJob) return this.partialJob;

        this.partialJob = (async () => {
            const partial = await this.options.loadPartial();
            if (!partial) {
                writeLogs([{ type: "error", message: `Resource ${this.key}: loadPartial failed, returning empty` }]);
                return this.latest?.data ?? ([] as unknown as T);
            }
            this.latest = { data: partial.data, etag: partial.etag, at: Date.now(), complete: partial.complete ?? false };
            if (this.latest.complete) {
                try {
                    this.options.persist?.(this.latest);
                } catch (e) {
                    const msg = e instanceof Error ? e.message : String(e);
                    writeLogs([{ type: "error", message: `Resource ${this.key}: persist failed: ${msg}` }]);
                }
            }
            return partial.data;
        })();

        try {
            const data = await this.partialJob;
            if (this.latest && !this.latest.complete) {
                this.kickComplete();
            }
            return data;
        } finally {
            this.partialJob = null;
        }
    }

    invalidate(clearPersisted: boolean = false) {
        this.latest = null;
        this.partialJob = null;
        this.completing = null;
        this.revalidating = null;
        if (clearPersisted) this.options.clearPersisted?.();
        writeLogs([{ type: "info", message: `Resource ${this.key}: invalidated${clearPersisted ? " (persisted cleared)" : ""}` }]);
    }

    private kickComplete() {
        if (this.completing) return;
        this.completing = this.doComplete()
            .catch((e) => {
                const msg = e instanceof Error ? e.message : String(e);
                writeLogs([{ type: "error", message: `Resource ${this.key}: background completion failed: ${msg}` }]);
            })
            .finally(() => {
                this.completing = null;
            });
    }

    private async doComplete() {
        const full = await this.options.loadFull();
        if (!full) {
            writeLogs([{ type: "error", message: `Resource ${this.key}: loadFull failed, keeping current state` }]);
            return;
        }
        this.latest = { data: full.data, etag: full.etag, at: Date.now(), complete: true };
        try {
            this.options.persist?.(this.latest);
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            writeLogs([{ type: "error", message: `Resource ${this.key}: persist failed: ${msg}` }]);
        }
        this.options.emit?.();
    }

    private kickRevalidate() {
        if (this.revalidating) return;
        this.revalidating = this.doRevalidate()
            .catch((e) => {
                const msg = e instanceof Error ? e.message : String(e);
                writeLogs([{ type: "error", message: `Resource ${this.key}: background revalidation failed: ${msg}` }]);
            })
            .finally(() => {
                this.revalidating = null;
            });
    }

    private async doRevalidate() {
        const latest = this.latest;
        if (!latest?.complete || !latest.etag) {
            this.kickComplete();
            return;
        }
        const result = await this.options.loadPartial(latest.etag);
        if (!result) {
            this.kickComplete();
            return;
        }
        if (result.notModified) {
            this.latest = { ...latest, at: Date.now() };
            writeLogs([{ type: "info", message: `Resource ${this.key}: revalidation 304, keeping cache` }]);
            return;
        }
        this.kickComplete();
    }
}
