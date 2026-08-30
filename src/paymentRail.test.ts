import assert from "node:assert/strict";
import { test } from "node:test";
import {
  PaymentRailError,
  PaymentRailResilience,
  executePaymentRail,
  isRetryablePaymentRailError,
} from "./paymentRail.js";

function transient(status = 503): Error & { status: number } {
  const error = new Error(`upstream returned ${status}`) as Error & { status: number };
  error.status = status;
  return error;
}

void test("retries an idempotent operation with bounded exponential delays and jitter", async () => {
  const delays: number[] = [];
  const metrics: string[] = [];
  let calls = 0;

  const result = await new PaymentRailResilience().execute(
    () => {
      calls += 1;
      if (calls < 3) return Promise.reject(transient());
      return Promise.resolve("settled");
    },
    {
      dependency: "acquirer-a",
      idempotent: true,
      config: { maxAttempts: 3, baseDelayMs: 10, maxDelayMs: 15, jitterRatio: 0 },
      sleep: (delay) => {
        delays.push(delay);
        return Promise.resolve();
      },
      onMetric: (metric) => metrics.push(metric.event),
    }
  );

  assert.equal(result, "settled");
  assert.equal(calls, 3);
  assert.deepEqual(delays, [10, 15]);
  assert.deepEqual(metrics, [
    "attempt",
    "retry_scheduled",
    "attempt",
    "retry_scheduled",
    "attempt",
    "success",
  ]);
});

void test("never retries a non-idempotent operation", async () => {
  let calls = 0;
  await assert.rejects(
    new PaymentRailResilience().execute(
      () => {
        calls += 1;
        return Promise.reject(transient());
      },
      {
        dependency: "acquirer-a",
        idempotent: false,
        sleep: () => Promise.reject(new Error("must not sleep")),
      }
    ),
    (error: unknown) =>
      error instanceof PaymentRailError &&
      error.code === "upstream_unavailable" &&
      error.attempts === 1
  );
  assert.equal(calls, 1);
});

void test("does not retry permanent declines", async () => {
  let calls = 0;
  await assert.rejects(
    new PaymentRailResilience().execute(
      () => {
        calls += 1;
        return Promise.reject(
          new PaymentRailError("upstream_rejected", "acquirer-a", "card declined")
        );
      },
      {
        dependency: "acquirer-a",
        idempotent: true,
        sleep: () => Promise.reject(new Error("must not sleep")),
      }
    ),
    (error: unknown) =>
      error instanceof PaymentRailError && error.code === "upstream_rejected"
  );
  assert.equal(calls, 1);
});

void test("opens after consecutive failures and rejects calls during cooldown", async () => {
  const resilience = new PaymentRailResilience();
  const now = 1_000;
  let calls = 0;
  const options = {
    dependency: "acquirer-a",
    idempotent: false,
    now: () => now,
    config: { failureThreshold: 2, cooldownMs: 100 },
  };
  const fail = () =>
    resilience.execute(() => {
      calls += 1;
      return Promise.reject(transient());
    }, options);
  await assert.rejects(fail, PaymentRailError);
  await assert.rejects(fail, PaymentRailError);
  await assert.rejects(
    fail,
    (error: unknown) =>
      error instanceof PaymentRailError && error.code === "circuit_open"
  );
  assert.equal(calls, 2);
  assert.equal(resilience.getBreakerSnapshot("acquirer-a", now)?.state, "open");
});

void test("allows a half-open probe after cooldown and closes on success", async () => {
  const resilience = new PaymentRailResilience();
  let now = 0;
  let shouldFail = true;
  const options = {
    dependency: "acquirer-a",
    idempotent: false,
    now: () => now,
    config: { failureThreshold: 1, cooldownMs: 50 },
  };
  await assert.rejects(resilience.execute(() => Promise.reject(transient()), options));
  now = 50;
  shouldFail = false;
  const result = await resilience.execute(
    () => (shouldFail ? Promise.reject(transient()) : Promise.resolve("probe-ok")),
    options
  );
  assert.equal(result, "probe-ok");
  assert.equal(resilience.getBreakerSnapshot("acquirer-a", now)?.state, "closed");
});

void test("keeps circuit state isolated per dependency", async () => {
  const resilience = new PaymentRailResilience();
  const options = { idempotent: false, config: { failureThreshold: 1 } };
  await assert.rejects(
    resilience.execute(() => Promise.reject(transient()), {
      ...options,
      dependency: "acquirer-a",
    })
  );
  const healthy = await resilience.execute(() => Promise.resolve("ok"), {
    ...options,
    dependency: "acquirer-b",
  });
  assert.equal(healthy, "ok");
  assert.equal(resilience.getBreakerSnapshot("acquirer-a")?.state, "open");
  assert.equal(resilience.getBreakerSnapshot("acquirer-b")?.state, "closed");
});

void test("default classifier accepts transient network and server failures only", () => {
  assert.equal(isRetryablePaymentRailError(transient(503)), true);
  assert.equal(isRetryablePaymentRailError({ code: "ETIMEDOUT" }), true);
  assert.equal(isRetryablePaymentRailError({ status: 409 }), false);
  assert.equal(isRetryablePaymentRailError({ status: 402 }), false);
});

void test("shared convenience executor preserves the public contract", async () => {
  const result = await executePaymentRail(() => Promise.resolve("ok"), {
    dependency: `test-${Date.now()}`,
    idempotent: true,
  });
  assert.equal(result, "ok");
});
