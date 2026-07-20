// One shared Redis connection for the whole app: the settlement ledger, the
// open-demo spend caps, and the SIWX auth nonce store all borrow it.
//
// Returns null when REDIS_URL is unset (zero-infra local dev) or the connection
// can't be established, so every caller degrades to in-process state.
//
// Crucially, a FAILED connect is not cached forever. The old per-module code did
// `g.__redis ??= connect()` and, when the first connect rejected, memoized a
// resolved-null promise — so a single Redis blip at startup pinned the app to
// per-process memory until the next deploy. Here only a SUCCESSFUL client is
// cached; after a failure the in-flight promise is cleared so the next call
// retries and the app self-heals once Redis is reachable again.

export type RedisClient = {
  lPush(key: string, value: string): Promise<number>;
  lTrim(key: string, start: number, stop: number): Promise<unknown>;
  lRange(key: string, start: number, stop: number): Promise<string[]>;
  del(key: string): Promise<number>;
  get(key: string): Promise<string | null>;
  getDel(key: string): Promise<string | null>;
  set(
    key: string,
    value: string,
    opts?: { PX?: number; EX?: number; NX?: boolean },
  ): Promise<unknown>;
  incrByFloat(key: string, value: number): Promise<string>;
  expire(key: string, seconds: number): Promise<unknown>;
};

const g = globalThis as unknown as {
  __agentifyRedisClient?: RedisClient;
  __agentifyRedisConnecting?: Promise<RedisClient | null>;
};

export async function getRedis(): Promise<RedisClient | null> {
  if (!process.env.REDIS_URL) return null;
  // A live client is reused; a failed attempt is never cached.
  if (g.__agentifyRedisClient) return g.__agentifyRedisClient;
  if (!g.__agentifyRedisConnecting) {
    g.__agentifyRedisConnecting = (async () => {
      let client: { connect(): Promise<unknown>; on(ev: string, cb: (e: unknown) => void): unknown; destroy?(): void } | undefined;
      try {
        const { createClient } = await import("redis");
        client = createClient({ url: process.env.REDIS_URL });
        // Never let a Redis hiccup take down a payment or auth path.
        client.on("error", (e: unknown) =>
          console.error("[redis] error:", e instanceof Error ? e.message : e),
        );
        await client.connect();
        g.__agentifyRedisClient = client as unknown as RedisClient;
        return g.__agentifyRedisClient;
      } catch (e) {
        // Don't leak a half-open client on a failed connect.
        try {
          client?.destroy?.();
        } catch {
          /* ignore */
        }
        console.warn(
          "[redis] WARN: unavailable; degrading to per-process memory (will retry):",
          e instanceof Error ? e.message : e,
        );
        return null;
      } finally {
        // Clear the in-flight promise so the NEXT call retries after a failure.
        g.__agentifyRedisConnecting = undefined;
      }
    })();
  }
  return g.__agentifyRedisConnecting;
}
