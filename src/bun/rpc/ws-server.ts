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

export class RpcWsServer {
  private server: ReturnType<typeof Bun.serve<unknown>> | undefined;
  private clients = new Set<ServerWebSocket<unknown>>();
  private readonly handlers: RpcHandlers;
  private readonly options: RpcServerOptions;
  private hasConnectedClient = false;

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
          this.dispatch(ws, message);
        },
        close: (ws) => {
          this.clients.delete(ws);
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
    try {
      const handler = this.handlers[method];
      if (typeof handler !== "function") {
        throw new Error(`Unknown method: ${method}`);
      }
      const result = await handler(params);
      ws.send(JSON.stringify({ id, result: result ?? null }));
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      ws.send(JSON.stringify({ id, error: { message } }));
    }
  }
}
