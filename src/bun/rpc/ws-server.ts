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

const REQUEST_ID_TTL_MS = 60_000;
const REQUEST_TIMEOUT_MS = 55_000;

export class RpcWsServer {
  private server: ReturnType<typeof Bun.serve<unknown>> | undefined;
  private clients = new Set<ServerWebSocket<unknown>>();
  private readonly handlers: RpcHandlers;
  private readonly options: RpcServerOptions;
  private hasConnectedClient = false;
  private queues = new WeakMap<ServerWebSocket<unknown>, Promise<void>>();
  private requests = new WeakMap<ServerWebSocket<unknown>, Map<string, { ts: number; state: "inflight" | "done"; response?: string }>>();

  constructor(handlers: RpcHandlers, options: RpcServerOptions = {}) {
    this.handlers = handlers;
    this.options = options;
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

  private enqueue(ws: ServerWebSocket<unknown>, task: () => Promise<void>): void {
    const previous = this.queues.get(ws) || Promise.resolve();
    const next = previous.then(async () => {
      try {
        await task();
      } catch (e) {
        // Ignore errors to prevent the chain from breaking
        console.error("Error in queued task:", e);
      }
    });
    this.queues.set(ws, next);
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
    const idStr = String(id);
    
    // Check for duplicate request ID with TTL and replay completed responses
    const clientRequests = this.requests.get(ws) ?? new Map();
    this.requests.set(ws, clientRequests);
    
    // Prune old entries
    const now = Date.now();
    for (const [key, entry] of clientRequests.entries()) {
      if (now - entry.ts > REQUEST_ID_TTL_MS) {
        clientRequests.delete(key);
      }
    }
    
    // Cap at 256 entries per client (remove oldest first)
    if (clientRequests.size >= 256) {
      const keys = Array.from(clientRequests.keys());
      for (let i = 0; i < keys.length - 255; i++) {
        clientRequests.delete(keys[i]);
      }
    }
    
    const existingEntry = clientRequests.get(idStr);
    if (existingEntry) {
      if (existingEntry.state === "inflight") {
        // Ignore duplicate inflight requests
        return;
      } else if (existingEntry.state === "done") {
        // Replay completed response
        ws.send(existingEntry.response!);
        return;
      }
    }
    
    // Mark as inflight before dispatching
    clientRequests.set(idStr, { ts: now, state: "inflight" });
    
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    
    const respond = (payload: string) => {
      if (settled) return;
      settled = true;
      if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }
      try {
        ws.send(payload);
      } catch (e) {
        console.error("Error sending response:", e);
      }
    };
    
    // Set up timeout
    timer = setTimeout(() => {
      respond(JSON.stringify({ id, error: { message: "Request timed out" } }));
    }, REQUEST_TIMEOUT_MS);
    
    // Unref the timer to avoid keeping process alive
    if (typeof timer.unref === 'function') {
      timer.unref();
    }
    
    try {
      const handler = this.handlers[method];
      if (typeof handler !== "function") {
        throw new Error(`Unknown method: ${method}`);
      }
      const result = await handler(params);
      const response = JSON.stringify({ id, result: result ?? null });
      // Mark as done and store the response
      clientRequests.set(idStr, { ts: now, state: "done", response });
      respond(response);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      const response = JSON.stringify({ id, error: { message } });
      // Mark as done and store the error response
      clientRequests.set(idStr, { ts: now, state: "done", response });
      respond(response);
    }
  }
}
