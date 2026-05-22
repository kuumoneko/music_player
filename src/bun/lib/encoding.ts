export function withSafeEncoding<T extends Record<string, (...args: unknown[]) => unknown>>(handlers: T): T {
  const wrapped: Record<string, (...args: unknown[]) => unknown> = {};

  for (const [key, handler] of Object.entries(handlers)) {
    if (typeof handler === "function") {
      wrapped[key] = async (...args: unknown[]) => {
        const result = await handler(...args);
        if (result !== undefined) {
          return encodeURIComponent(JSON.stringify(result));
        }
        return result;
      };
    } else {
      wrapped[key] = handler;
    }
  }

  return wrapped as T;
}
