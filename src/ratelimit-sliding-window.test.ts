import { beforeEach, describe, it } from "node:test";
import assert from "node:assert";
import type { Request } from "express";
import {
  applyRateLimitHit,
  deriveRateLimitKey,
  getRateLimitWindowState,
  pruneExpiredRateBuckets,
} from "./middleware/index.js";
import { hashApiKey } from "./auth/apiKeys.js";
import { apiKeyStore, rateBuckets } from "./store/state.js";

const WINDOW_MS = 60_000;
const LIMIT = 3;

beforeEach(() => {
  rateBuckets.clear();
  apiKeyStore.clear();
});

function requestLike(
  headers: Record<string, string> = {},
  overrides: Partial<Request> = {}
): Request {
  return {
    header(name: string): string | undefined {
      return headers[name.toLowerCase()];
    },
    ip: "198.51.100.10",
    socket: { remoteAddress: "198.51.100.11" },
    ...overrides,
  } as Request;
}

void describe("bounded sliding-window rate limiter", () => {
  void it("allows requests below the limit and reports the weighted count", () => {
    assert.deepStrictEqual(applyRateLimitHit("tenant-a", 1_000, LIMIT, WINDOW_MS), {
      allowed: true,
    });
    assert.deepStrictEqual(applyRateLimitHit("tenant-a", 2_000, LIMIT, WINDOW_MS), {
      allowed: true,
    });

    const state = getRateLimitWindowState("tenant-a", 2_000, WINDOW_MS);
    assert.strictEqual(state.estimatedCount, 2);
    assert.strictEqual(state.resetAt, 61_000);
    assert.strictEqual(rateBuckets.get("tenant-a") instanceof Array, false);
  });

  void it("rejects the request at the configured ceiling without adding a hit", () => {
    applyRateLimitHit("tenant-a", 1_000, LIMIT, WINDOW_MS);
    applyRateLimitHit("tenant-a", 2_000, LIMIT, WINDOW_MS);
    applyRateLimitHit("tenant-a", 3_000, LIMIT, WINDOW_MS);

    const limited = applyRateLimitHit("tenant-a", 4_000, LIMIT, WINDOW_MS);

    assert.deepStrictEqual(limited, {
      allowed: false,
      retryAfterSeconds: 57,
    });
    const bucket = rateBuckets.get("tenant-a");
    assert.ok(bucket && !Array.isArray(bucket));
    if (bucket && !Array.isArray(bucket)) assert.strictEqual(bucket.currentCount, 3);
  });

  void it("uses the previous window with a conservative weighted estimate", () => {
    for (const time of [0, 100, 200]) {
      assert.deepStrictEqual(applyRateLimitHit("tenant-a", time, LIMIT, WINDOW_MS), {
        allowed: true,
      });
    }

    // Crossing the boundary must retain almost all of the previous window's
    // pressure. A fixed-window reset would incorrectly allow this request.
    const boundary = applyRateLimitHit("tenant-a", 60_000, LIMIT, WINDOW_MS);
    assert.deepStrictEqual(boundary, {
      allowed: false,
      retryAfterSeconds: 1,
    });
  });

  void it("eventually releases previous-window pressure as it ages out", () => {
    for (const time of [0, 100, 200]) {
      applyRateLimitHit("tenant-a", time, LIMIT, WINDOW_MS);
    }

    const nearExpiry = applyRateLimitHit("tenant-a", 119_999, LIMIT, WINDOW_MS);
    assert.deepStrictEqual(nearExpiry, { allowed: true });
    const state = getRateLimitWindowState("tenant-a", 119_999, WINDOW_MS);
    assert.strictEqual(Math.ceil(state.estimatedCount), 2);
  });

  void it("keeps each authenticated API key in an independent tenant budget", () => {
    const keyA = "apk_sliding_tenant_a";
    const keyB = "apk_sliding_tenant_b";
    const hashA = hashApiKey(keyA);
    const hashB = hashApiKey(keyB);
    apiKeyStore.set(hashA, { label: "a", createdAt: 1, prefix: "apk_slidi" });
    apiKeyStore.set(hashB, { label: "b", createdAt: 1, prefix: "apk_slidi" });

    const reqA = requestLike({ "x-api-key": keyA });
    const reqB = requestLike({ "x-api-key": keyB });
    const authenticatedA = reqA as Request & { apiKeyHash: string };
    const authenticatedB = reqB as Request & { apiKeyHash: string };
    authenticatedA.apiKeyHash = hashA;
    authenticatedB.apiKeyHash = hashB;

    const bucketA = deriveRateLimitKey(authenticatedA);
    const bucketB = deriveRateLimitKey(authenticatedB);
    assert.notStrictEqual(bucketA, bucketB);
    for (let i = 0; i < LIMIT; i += 1) {
      assert.deepStrictEqual(applyRateLimitHit(bucketA, i, LIMIT, WINDOW_MS), {
        allowed: true,
      });
    }
    assert.deepStrictEqual(applyRateLimitHit(bucketA, LIMIT, LIMIT, WINDOW_MS), {
      allowed: false,
      retryAfterSeconds: 60,
    });
    assert.deepStrictEqual(applyRateLimitHit(bucketB, LIMIT, LIMIT, WINDOW_MS), {
      allowed: true,
    });
  });

  void it("does not let an invalid API-key header create a new identity", () => {
    const first = deriveRateLimitKey(requestLike({ "x-api-key": "not-valid-a" }));
    const second = deriveRateLimitKey(requestLike({ "x-api-key": "not-valid-b" }));

    assert.strictEqual(first, "ip:198.51.100.10");
    assert.strictEqual(second, first);
  });

  void it("normalizes legacy timestamp seeds once and bounds the stored state", () => {
    rateBuckets.set("legacy", [1_000, 2_000, 61_000, 62_000]);

    const result = applyRateLimitHit("legacy", 62_000, 10, WINDOW_MS);

    assert.deepStrictEqual(result, { allowed: true });
    const bucket = rateBuckets.get("legacy");
    assert.ok(bucket && !Array.isArray(bucket));
    if (bucket && !Array.isArray(bucket)) {
      assert.deepStrictEqual(bucket, {
        currentWindowStart: 62_000,
        currentCount: 1,
        previousWindowStart: 2_000,
        previousCount: 3,
      });
    }
  });

  void it("rolls a compact counter forward after one complete window", () => {
    applyRateLimitHit("tenant-a", 1_000, LIMIT, WINDOW_MS);
    const before = rateBuckets.get("tenant-a");
    assert.ok(before && !Array.isArray(before));

    applyRateLimitHit("tenant-a", 121_000, LIMIT, WINDOW_MS);
    const after = rateBuckets.get("tenant-a");
    assert.ok(after && !Array.isArray(after));
    if (after && !Array.isArray(after)) {
      assert.strictEqual(after.currentWindowStart, 121_000);
      assert.strictEqual(after.currentCount, 1);
      assert.strictEqual(after.previousCount, 0);
    }
  });

  void it("prunes idle counters without scanning individual request timestamps", () => {
    applyRateLimitHit("active", 1_000, LIMIT, WINDOW_MS);
    applyRateLimitHit("stale", 1_000, LIMIT, WINDOW_MS);

    const removed = pruneExpiredRateBuckets(180_001, WINDOW_MS);

    assert.strictEqual(removed, 2);
    assert.strictEqual(rateBuckets.size, 0);
  });

  void it("keeps the decision atomic within a synchronous process turn", () => {
    const decisions = Array.from({ length: 20 }, (_, index) =>
      applyRateLimitHit("race-key", 10_000 + index, 5, WINDOW_MS)
    );

    assert.strictEqual(decisions.filter((decision) => decision.allowed).length, 5);
    assert.strictEqual(decisions.filter((decision) => !decision.allowed).length, 15);
    const bucket = rateBuckets.get("race-key");
    assert.ok(bucket && !Array.isArray(bucket));
    if (bucket && !Array.isArray(bucket)) assert.strictEqual(bucket.currentCount, 5);
  });

  void it("does not allow a bucket to grow with repeated rejected requests", () => {
    applyRateLimitHit("bounded", 1_000, 1, WINDOW_MS);
    for (let i = 0; i < 100; i += 1) {
      assert.strictEqual(
        applyRateLimitHit("bounded", 2_000 + i, 1, WINDOW_MS).allowed,
        false
      );
    }

    const bucket = rateBuckets.get("bounded");
    assert.ok(bucket && !Array.isArray(bucket));
    if (bucket && !Array.isArray(bucket)) {
      assert.strictEqual(bucket.currentCount, 1);
      assert.strictEqual(bucket.previousCount, 0);
      assert.strictEqual(Object.keys(bucket).length, 4);
    }
  });
});
