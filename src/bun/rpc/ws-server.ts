import type { ServerWebSocket } from "bun";

export type RpcHandler = (params: any) => unknown | Promise<unknown>;
export type RpcHandlers = Record<string, RpcHandler>;

interface RpcRequest {
  id: number;
  method: string;
  params?: unknown;
}

interface RpcServerOptions {
  onTick?: () => void;
  onFirstClient?: () => void;
}

interface DedupEntry {
  state: "inflight" | "done";
  at: number;
  response?: string;
}

const DEDUP_TTL_MS = 60_000;
const DEDUP_MAX_PER_CLIENT = 256;
const REQUEST_TIMEOUT_MS = 55_000;

export class RpcWsServer {
  private server: ReturnType<typeof Bun.serve<unknown>> | undefined;
  private clients = new Set<ServerWebSocket<unknown>>();
  private readonly handlers: RpcHandlers;
  private readonly options: RpcServerOptions;
  private hasConnectedClient = false;
  private queues = new WeakMap<ServerWebSocket<unknown>, Promise<void>>();
  private dedup = new WeakMap<ServerWebSocket<unknown>, Map<string, DedupEntry>>();

  constructor(handlers: RpcHandlers, options: RpcServerOptions = {}) {
    this.handlers = handlers;
    this.options = options;
  }

  private enqueue(ws: ServerWebSocket<unknown>, task: () => Promise<void>): void {
    const previous = this.queues.get(ws) || Promise.resolve();
    const current = previous.then(async () => {
      try {
        await task();
      } catch (e) {
        console.error("Error in queued task:", e);
      }
    });
    this.queues.set(ws, current);
  }

  private dedupFor(ws: ServerWebSocket<unknown>): Map<string, DedupEntry> {
    let map = this.dedup.get(ws);
    if (!map) {
      map = new Map<string, DedupEntry>();
      this.dedup.set(ws, map);
    }
    return map;
  }

  private evictDedupOldest(map: Map<string, DedupEntry>): void {
    if (map.size <= DEDUP_MAX_PER_CLIENT) return;
    let oldestKey: string | undefined;
    let oldestAt = Infinity;
    for (const [key, entry] of map) {
      if (entry.at < oldestAt) {
        oldestAt = entry.at;
        oldestKey = key;
      }
    }
    if (oldestKey !== undefined) map.delete(oldestKey);
  }

  start(hostname: string, port: number): void {
    this.server = Bun.serve({
      hostname,
      port,
      fetch: (req, server) => {
        const url = new URL(req.url);
        if (url.pathname === "/ws" && server.upgrade(req, { data: null })) {
          return undefined;
        }
        this.options.onTick?.();
        return new Response("OK");
      },
      websocket: {
        open: (ws) => {
          this.clients.add(ws);
          if (!this.hasConnectedClient) {
            this.hasConnectedClient = true;
            this.options.onFirstClient?.();
          }
        },
        message: (ws, message) => {
          this.enqueue(ws, () => this.dispatch(ws, message));
        },
        close: (ws) => {
          this.clients.delete(ws);
          this.queues.delete(ws);
          this.dedup.delete(ws);
        },
      },
    });
  }

  get hostname(): string {
    return this.server?.hostname ?? "";
  }

  get port(): number {
    return this.server?.port ?? 0;
  }

  stop(): void {
    this.server?.stop(true);
    this.clients.clear();
  }

  broadcast(event: string, data: unknown): void {
    if (this.clients.size === 0) return;
    const payload = JSON.stringify({ event, data });
    for (const ws of this.clients) {
      try {
        ws.send(payload);
      } catch {
        this.clients.delete(ws);
      }
    }
  }

  private async dispatch(ws: ServerWebSocket<unknown>, raw: string | Buffer): Promise<void> {
    let request: RpcRequest;
    try {
      request = JSON.parse(String(raw));
    } catch {
      return;
    }
    if (!request || typeof request !== "object" || typeof request.method !== "string" || request.id === undefined) {
      return;
    }
    const { id, method, params } = request;

    const key = String(id);
    const dedup = this.dedupFor(ws);
    const existing = dedup.get(key);
    if (existing) {
      if (existing.state === "inflight") {
        // Duplicate while the original is still running: drop silently.
        return;
      }
      if (Date.now() - existing.at < DEDUP_TTL_MS && existing.response !== undefined) {
        // Completed within TTL: replay the cached response without re-invoking the handler.
        try {
          ws.send(existing.response);
        } catch (e) {
          console.error("Error sending cached response:", e);
        }
        return;
      }
      // Expired: fall through and re-execute.
      dedup.delete(key);
    }

    dedup.set(key, { state: "inflight", at: Date.now() });
    this.evictDedupOldest(dedup);

    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const respond = (payload: string): void => {
      if (settled) return;
      settled = true;
      if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }
      // Finalize the dedupe entry even on timeout, so a retry replays it.
      dedup.set(key, { state: "done", at: Date.now(), response: payload });
      this.evictDedupOldest(dedup);
      try {
        ws.send(payload);
      } catch (e) {
        console.error("Error sending response:", e);
      }
    };

    timer = setTimeout(() => {
      respond(JSON.stringify({ id, error: { message: "Request timed out" } }));
    }, REQUEST_TIMEOUT_MS);
    (timer as any).unref?.();

    try {
      const handler = this.handlers[method];
      if (typeof handler !== "function") {
        throw new Error(`Unknown method: ${method}`);
      }
      const result = await handler(params);
      respond(JSON.stringify({ id, result: result ?? null }));
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      respond(JSON.stringify({ id, error: { message } }));
    }
  }
}
