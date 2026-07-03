import { beforeEach, describe, it } from "node:test";
import assert from "node:assert";
import { applyRateLimitHit, pruneExpiredRateBuckets } from "./middleware/index.js";
import { rateBuckets } from "./store/state.js";

void describe("rate limit bucket pruning", () => {
  beforeEach(() => {
    rateBuckets.clear();
  });

  void it("prunes expired buckets without waiting for real time", () => {
    rateBuckets.set("stale-a", [1_000]);
    rateBuckets.set("stale-b", [10_000, 20_000]);
    rateBuckets.set("active", [80_000]);

    const pruned = pruneExpiredRateBuckets(120_000, 60_000);

    assert.strictEqual(pruned, 2);
    assert.strictEqual(rateBuckets.has("stale-a"), false);
    assert.strictEqual(rateBuckets.has("stale-b"), false);
    assert.deepStrictEqual(rateBuckets.get("active"), [80_000]);
  });

  void it("bounds map size after churn from many one-shot IPs", () => {
    for (let i = 0; i < 100; i++) {
      rateBuckets.set(`198.51.100.${i}`, [1_000]);
    }

    const decision = applyRateLimitHit("203.0.113.10", 120_000, 60, 60_000);

    assert.deepStrictEqual(decision, { allowed: true });
    assert.strictEqual(rateBuckets.size, 1);
    assert.deepStrictEqual(rateBuckets.get("203.0.113.10"), [120_000]);
  });

  void it("does not reset an active limiter while pruning stale buckets", () => {
    rateBuckets.set("stale", [1_000]);

    assert.deepStrictEqual(applyRateLimitHit("active", 100_000, 2, 60_000), {
      allowed: true,
    });
    assert.deepStrictEqual(applyRateLimitHit("active", 100_001, 2, 60_000), {
      allowed: true,
    });
    const limited = applyRateLimitHit("active", 100_002, 2, 60_000);

    assert.deepStrictEqual(limited, {
      allowed: false,
      retryAfterSeconds: 60,
    });
    assert.strictEqual(rateBuckets.has("stale"), false);
    assert.deepStrictEqual(rateBuckets.get("active"), [100_000, 100_001]);
  });

  void it("starts a fresh bucket after an IP has been idle past the window", () => {
    assert.deepStrictEqual(applyRateLimitHit("198.51.100.50", 1_000, 60, 60_000), {
      allowed: true,
    });

    const afterIdle = applyRateLimitHit("198.51.100.50", 120_000, 60, 60_000);

    assert.deepStrictEqual(afterIdle, { allowed: true });
    assert.deepStrictEqual(rateBuckets.get("198.51.100.50"), [120_000]);
  });
});
