import { assertEquals } from "@std/assert";
import { Redis } from "@upstash/redis";

const url = Deno.env.get("UPSTASH_REDIS_REST_URL");
const token = Deno.env.get("UPSTASH_REDIS_REST_TOKEN");

if (!url || !token) {
  throw new Error(
    "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required.",
  );
}

Deno.test("Upstash Redis connection smoke test", async () => {
  const redis = new Redis({
    url,
    token,
  });

  const key = `smoke-test:${crypto.randomUUID()}`;

  try {
    await redis.set(key, "ok");

    const value = await redis.get<string>(key);

    assertEquals(value, "ok");
  } finally {
    await redis.del(key);
  }
});
