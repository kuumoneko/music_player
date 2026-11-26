import { describe, expect, test } from "bun:test";
import { RpcWsServer } from "../../src/bun/rpc/ws-server.ts";

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

interface FakeSocket {
  sent: string[];
  send: (payload: string) => void;
}

function fakeSocket(): FakeSocket {
  return {
    sent: [],
    send(payload: string) {
      this.sent.push(payload);
    },
  };
}

function asServer(server: RpcWsServer): any {
  return server as any;
}

async function waitFor(predicate: () => boolean, timeoutMs = 1_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error("waitFor timed out");
    await sleep(5);
  }
}

describe("RpcWsServer per-client FIFO queue (1.1)", () => {
  test("messages on one socket run strictly in order", async () => {
    const server = new RpcWsServer({});
    const ws = fakeSocket();
    const log: string[] = [];

    asServer(server).enqueue(ws, async () => {
      log.push("a-start");
      await sleep(15);
      log.push("a-end");
    });
    asServer(server).enqueue(ws, async () => {
      log.push("b");
    });
    asServer(server).enqueue(ws, async () => {
      log.push("c");
    });

    await sleep(40);
    expect(log).toEqual(["a-start", "a-end", "b", "c"]);
  });

  test("malformed JSON and a throwing handler do not poison later messages", async () => {
    let calls = 0;
    const server = new RpcWsServer({
      ok: async () => {
        calls++;
        return "ok";
      },
      boom: () => {
        throw new Error("handler exploded");
      },
    });
    const ws = fakeSocket();
    const dispatch = (raw: string) => asServer(server).dispatch(ws, raw);

    asServer(server).enqueue(ws, () => dispatch("{not-json"));
    asServer(server).enqueue(ws, () => dispatch(JSON.stringify({ id: 1, method: "boom" })));
    asServer(server).enqueue(ws, () => dispatch(JSON.stringify({ id: 2, method: "ok" })));

    await sleep(30);

    expect(calls).toBe(1);
    // Only the successful request produced a result frame; the malformed and
    // throwing requests were handled without breaking the chain.
    const result = ws.sent
      .map((raw) => JSON.parse(raw))
      .filter((frame) => frame.result !== undefined);
    expect(result).toEqual([{ id: 2, result: "ok" }]);
    expect(ws.sent.some((raw) => JSON.parse(raw).error?.message === "handler exploded")).toBe(true);
  });

  test("two separate clients do not block each other", async () => {
    const server = new RpcWsServer({});
    const slow = fakeSocket();
    const fast = fakeSocket();
    const order: string[] = [];

    asServer(server).enqueue(slow, async () => {
      await sleep(40);
      order.push("slow");
    });
    asServer(server).enqueue(fast, async () => {
      order.push("fast");
    });

    await sleep(10);
    expect(order).toEqual(["fast"]);
    await sleep(50);
    expect(order).toEqual(["fast", "slow"]);
  });

  test("close removes the client's queue entry", async () => {
    const server = new RpcWsServer({});
    server.start("127.0.0.1", 0);

    try {
      const ws = new WebSocket(`ws://127.0.0.1:${server.port}/ws`);
      await new Promise<void>((resolve, reject) => {
        ws.onopen = () => resolve();
        ws.onerror = () => reject(new Error("websocket failed to open"));
      });
      await waitFor(() => asServer(server).clients.size === 1);

      const serverWs = [...asServer(server).clients][0];
      expect(asServer(server).queues.has(serverWs)).toBe(false);

      ws.send(JSON.stringify({ id: 1, method: "missing" }));
      await waitFor(() => asServer(server).queues.has(serverWs));

      ws.close();
      await waitFor(() => asServer(server).clients.size === 0);
      expect(asServer(server).queues.has(serverWs)).toBe(false);
    } finally {
      server.stop();
    }
  });
});

describe("RpcWsServer single-settlement and 55s timeout (1.3)", () => {
  test("timed out request sends exactly one frame, finalizes dedupe and drops the late result", async () => {
    let calls = 0;
    let release: (value: string) => void = () => {};
    const pending = new Promise<string>((resolve) => {
      release = resolve;
    });
    const server = new RpcWsServer({
      slow: async () => {
        calls++;
        return pending;
      },
    });
    const ws = fakeSocket();

    let timeoutCallback: (() => void) | undefined;
    const realSetTimeout = globalThis.setTimeout;
    (globalThis as any).setTimeout = ((cb: (...args: any[]) => void, ms: number, ...args: any[]) => {
      if (ms === 55_000) timeoutCallback = () => cb(...args);
      return realSetTimeout(cb, ms, ...args);
    }) as typeof setTimeout;

    try {
      const inFlight = asServer(server).dispatch(ws, JSON.stringify({ id: 1, method: "slow" }));
      await sleep(5);
      expect(timeoutCallback).toBeDefined();

      timeoutCallback!();
      expect(ws.sent).toHaveLength(1);
      expect(JSON.parse(ws.sent[0])).toEqual({ id: 1, error: { message: "Request timed out" } });

      // A retry while the handler is still running replays the finalized
      // timeout payload and never re-invokes the handler.
      await asServer(server).dispatch(ws, JSON.stringify({ id: 1, method: "slow" }));
      expect(calls).toBe(1);
      expect(ws.sent).toHaveLength(2);
      expect(JSON.parse(ws.sent[1]).error.message).toBe("Request timed out");

      release("late");
      await inFlight;
      // The late result produced no second frame for the same request.
      expect(ws.sent).toHaveLength(2);
    } finally {
      globalThis.setTimeout = realSetTimeout;
    }
  });

  test("ws.send throwing on a closed socket is caught safely", async () => {
    const server = new RpcWsServer({
      ok: async () => "value",
    });
    const ws = {
      send() {
        throw new Error("socket closed");
      },
    };

    const originalError = console.error;
    console.error = () => {};
    try {
      await expect(asServer(server).dispatch(ws, JSON.stringify({ id: 8, method: "ok" }))).resolves.toBeUndefined();
    } finally {
      console.error = originalError;
    }
  });
});
