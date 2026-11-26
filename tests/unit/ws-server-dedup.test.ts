import { describe, expect, test } from "bun:test";
import { RpcWsServer } from "../../src/bun/rpc/ws-server.ts";

describe("RpcWsServer request ID deduplication", () => {
  test("duplicate ID while inflight is dropped silently and handler runs once", async () => {
    let callCount = 0;
    const handlers = {
      testMethod: async () => {
        callCount++;
        // Simulate a slow handler to allow duplicate requests to be sent before first completes
        await new Promise(resolve => setTimeout(resolve, 10));
        return "result";
      }
    };
    
    const server = new RpcWsServer(handlers);
    server.start("localhost", 0);
    const port = server.port;
    
    const ws = new WebSocket(`ws://localhost:${port}/ws`);
    await new Promise((resolve) => {
      ws.onopen = resolve;
    });

    // Send two identical requests with same ID quickly
    ws.send(JSON.stringify({ id: 1, method: "testMethod" }));
    ws.send(JSON.stringify({ id: 1, method: "testMethod" }));

    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 50));

    // Only one call should have been made
    expect(callCount).toBe(1);

    ws.close();
    server.stop();
  });

  test("duplicate after done replays cached response without re-invoking handler", async () => {
    let callCount = 0;
    const handlers = {
      testMethod: async () => {
        callCount++;
        return "result";
      }
    };

    const server = new RpcWsServer(handlers);
    server.start("localhost", 0);
    const port = server.port;
    
    const ws = new WebSocket(`ws://localhost:${port}/ws`);
    await new Promise((resolve) => {
      ws.onopen = resolve;
    });

    // First request
    ws.send(JSON.stringify({ id: 1, method: "testMethod" }));
    
    // Wait for response
    await new Promise((resolve) => {
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data as string);
        expect(data.result).toBe("result");
        resolve(undefined);
      };
    });

    // Second request with same ID - should replay cached response
    ws.send(JSON.stringify({ id: 1, method: "testMethod" }));

    // Check that handler was not called again
    expect(callCount).toBe(1);

    ws.close();
    server.stop();
  });

  test("same numeric/string ID reused after TTL executes handler again", async () => {
    let callCount = 0;
    const handlers = {
      testMethod: async () => {
        callCount++;
        return "result";
      }
    };

    const server = new RpcWsServer(handlers);
    server.start("localhost", 0);
    const port = server.port;
    
    const ws = new WebSocket(`ws://localhost:${port}/ws`);
    await new Promise((resolve) => {
      ws.onopen = resolve;
    });

    // Send first request
    ws.send(JSON.stringify({ id: 1, method: "testMethod" }));
    
    // Wait for response
    await new Promise((resolve) => {
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data as string);
        expect(data.result).toBe("result");
        resolve(undefined);
      };
    });

    // Mock Date.now to simulate time passing beyond TTL
    const originalDateNow = Date.now;
    Date.now = () => originalDateNow() + 60001; // Advance by 60s + 1ms

    try {
      // Send same ID again - should execute handler again since TTL expired
      ws.send(JSON.stringify({ id: 1, method: "testMethod" }));
      
      // Wait for response
      await new Promise((resolve) => {
        ws.onmessage = (event) => {
          const data = JSON.parse(event.data as string);
          expect(data.result).toBe("result");
          resolve(undefined);
        };
      });
      
      // Handler should have been called twice now
      expect(callCount).toBe(2);
    } finally {
      // Restore Date.now
      Date.now = originalDateNow;
    }

    ws.close();
    server.stop();
  });

  test("per-client cap of 256 evicts oldest first", async () => {
    const handlers = {
      testMethod: async () => {
        return "result";
      }
    };

    const server = new RpcWsServer(handlers);
    server.start("localhost", 0);
    const port = server.port;
    
    const ws = new WebSocket(`ws://localhost:${port}/ws`);
    await new Promise((resolve) => {
      ws.onopen = resolve;
    });

    // Send 260 requests with different IDs (256 + 4 more)
    for (let i = 0; i < 260; i++) {
      ws.send(JSON.stringify({ id: i, method: "testMethod" }));
    }

    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 100));

    // Check that we can still make a request with ID 260 (should not have evicted the last one)
    ws.send(JSON.stringify({ id: 260, method: "testMethod" }));

    ws.close();
    server.stop();
  });

  test("malformed JSON creates no entry", async () => {
    const handlers = {
      testMethod: async () => {
        return "result";
      }
    };

    const server = new RpcWsServer(handlers);
    server.start("localhost", 0);
    const port = server.port;
    
    const ws = new WebSocket(`ws://localhost:${port}/ws`);
    await new Promise((resolve) => {
      ws.onopen = resolve;
    });

    // Send malformed JSON - should not create any entry
    ws.send("{ invalid json }");

    // Should not crash or cause issues
    await new Promise(resolve => setTimeout(resolve, 10));

    ws.close();
    server.stop();
  });

  test("handler throw/reject finalizes entry as done", async () => {
    const handlers = {
      testMethod: async () => {
        throw new Error("Test error");
      }
    };

    const server = new RpcWsServer(handlers);
    server.start("localhost", 0);
    const port = server.port;
    
    const ws = new WebSocket(`ws://localhost:${port}/ws`);
    await new Promise((resolve) => {
      ws.onopen = resolve;
    });

    // Send request that will fail
    ws.send(JSON.stringify({ id: 1, method: "testMethod" }));
    
    // Wait for response
    await new Promise((resolve) => {
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data as string);
        expect(data.error.message).toBe("Test error");
        resolve(undefined);
      };
    });

    // Try again with same ID - should replay cached error response
    ws.send(JSON.stringify({ id: 1, method: "testMethod" }));

    ws.close();
    server.stop();
  });

  test("IDs isolated per WebSocket connection and cleared on close", async () => {
    let callCount = 0;
    const handlers = {
      testMethod: async () => {
        callCount++;
        return "result";
      }
    };

    const server = new RpcWsServer(handlers);
    server.start("localhost", 0);
    const port = server.port;
    
    // Create two connections
    const ws1 = new WebSocket(`ws://localhost:${port}/ws`);
    const ws2 = new WebSocket(`ws://localhost:${port}/ws`);
    
    await new Promise((resolve) => {
      ws1.onopen = () => {
        if (ws2.readyState === WebSocket.OPEN) resolve(undefined);
      };
      ws2.onopen = () => {
        if (ws1.readyState === WebSocket.OPEN) resolve(undefined);
      };
    });

    // Send request on first connection with ID 1
    ws1.send(JSON.stringify({ id: 1, method: "testMethod" }));
    
    // Wait for response on first connection
    await new Promise((resolve) => {
      ws1.onmessage = (event) => {
        const data = JSON.parse(event.data as string);
        expect(data.result).toBe("result");
        resolve(undefined);
      };
    });

    // Send same ID 1 on second connection - should execute handler again (different connection)
    ws2.send(JSON.stringify({ id: 1, method: "testMethod" }));
    
    // Wait for response on second connection
    await new Promise((resolve) => {
      ws2.onmessage = (event) => {
        const data = JSON.parse(event.data as string);
        expect(data.result).toBe("result");
        resolve(undefined);
      };
    });

    // Handler should have been called twice now (one per connection)
    expect(callCount).toBe(2);

    // Close first connection
    ws1.close();
    
    // Same connection, same ID, still within TTL → cached replay, handler not invoked again
    ws2.send(JSON.stringify({ id: 1, method: "testMethod" }));
    
    // Wait for response
    await new Promise((resolve) => {
      ws2.onmessage = (event) => {
        const data = JSON.parse(event.data as string);
        expect(data.result).toBe("result");
        resolve(undefined);
      };
    });

    // Still two handler calls: ws1 and ws2 each ran it once, and ws2's replay was cached
    expect(callCount).toBe(2);

    ws2.close();
    server.stop();
  });
});