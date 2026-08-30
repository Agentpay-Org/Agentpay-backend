import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildSignedWebhookRequest,
  deliverEventToWebhooks,
  deliverWebhook,
  getDeadLetter,
  listDeadLetters,
  replayDeadLetter,
  verifyWebhookSignature,
  WebhookDeliveryError,
} from "./services/webhookDelivery.js";
import {
  webhookDeadLetterStore,
  webhookDeliveredStore,
  webhookSecretStore,
  webhookStore,
} from "./store/state.js";

const webhook = { url: "https://example.test/events", events: ["charge.created"], createdAt: 1 };
const input = {
  deliveryId: "delivery_1",
  webhookId: "webhook_1",
  eventType: "charge.created",
  payload: { chargeId: "charge_1", amount: 42 },
};

beforeEach(() => {
  webhookDeadLetterStore.clear();
  webhookDeliveredStore.clear();
  webhookSecretStore.clear();
  webhookStore.clear();
});

void describe("signed webhook delivery", () => {
  void it("creates a verifiable timestamp-bound signature", () => {
    const request = buildSignedWebhookRequest(input, "secret", 1_700_000_000);
    assert.equal(
      verifyWebhookSignature(
        request.body,
        "secret",
        1_700_000_000,
        request.headers["X-Signature"],
      ),
      true,
    );
    assert.equal(
      verifyWebhookSignature(
        request.body.replace("charge_1", "charge_2"),
        "secret",
        1_700_000_000,
        request.headers["X-Signature"],
      ),
      false,
    );
    assert.equal(request.headers["X-Signature-Timestamp"], "1700000000");
    assert.equal(request.headers["X-Delivery-Id"], "delivery_1");
  });

  void it("retries a transient 5xx and signs each attempt", async () => {
    const statuses = [503, 200];
    const requests: { body: string; headers: Record<string, string> }[] = [];
    const result = await deliverWebhook(webhook, input, {
      secret: "secret",
      maxAttempts: 4,
      now: (() => {
        let timestamp = 100;
        return () => timestamp++;
      })(),
      random: () => 0,
      sleep: () => Promise.resolve(),
      transport: (_url, request) => {
        requests.push(request);
        return Promise.resolve({ status: statuses.shift() ?? 200 });
      },
    });
    assert.deepEqual(result, {
      deliveryId: "delivery_1",
      delivered: true,
      attempts: 2,
      deadLettered: false,
    });
    assert.equal(requests.length, 2);
    assert.notEqual(requests[0]?.headers["X-Signature"], requests[1]?.headers["X-Signature"]);
    assert.equal(
      verifyWebhookSignature(
        requests[1]?.body ?? "",
        "secret",
        Number(requests[1]?.headers["X-Signature-Timestamp"]),
        requests[1]?.headers["X-Signature"] ?? "",
      ),
      true,
    );
    assert.equal(listDeadLetters().length, 0);
  });

  void it("moves exhausted transient deliveries to the dead-letter queue", async () => {
    let calls = 0;
    const result = await deliverWebhook(webhook, input, {
      secret: "secret",
      maxAttempts: 3,
      sleep: () => Promise.resolve(),
      random: () => 0.5,
      transport: () => {
        calls++;
        return Promise.resolve({ status: 503 });
      },
    });
    assert.equal(calls, 3);
    assert.equal(result.delivered, false);
    assert.equal(result.deadLettered, true);
    assert.equal(result.attempts, 3);
    assert.equal(getDeadLetter("delivery_1")?.lastError, "upstream returned HTTP 503");
    assert.equal(getDeadLetter("delivery_1")?.attempts, 3);
  });

  void it("does not retry a non-retryable client response", async () => {
    let calls = 0;
    const result = await deliverWebhook(webhook, input, {
      secret: "secret",
      maxAttempts: 5,
      sleep: () => Promise.resolve(),
      transport: () => {
        calls++;
        return Promise.resolve({ status: 400 });
      },
    });
    assert.equal(calls, 1);
    assert.equal(result.attempts, 1);
    assert.equal(getDeadLetter("delivery_1")?.attempts, 1);
  });

  void it("replays a dead-lettered delivery with its stable id", async () => {
    await deliverWebhook(webhook, input, {
      secret: "secret",
      maxAttempts: 1,
      sleep: () => Promise.resolve(),
      transport: () => Promise.resolve({ status: 503 }),
    });
    const replay = await replayDeadLetter("delivery_1", webhook, {
      secret: "secret",
      sleep: () => Promise.resolve(),
      transport: (_url, request) => {
        assert.equal(request.headers["X-Delivery-Id"], "delivery_1");
        return Promise.resolve({ status: 204 });
      },
    });
    assert.equal(replay.delivered, true);
    assert.equal(replay.deliveryId, "delivery_1");
    assert.equal(getDeadLetter("delivery_1"), undefined);
    assert.equal(webhookDeliveredStore.has("delivery_1"), true);
  });

  void it("does not deliver a completed id twice", async () => {
    webhookDeliveredStore.add("delivery_1");
    let calls = 0;
    const result = await deliverWebhook(webhook, input, {
      secret: "secret",
      transport: () => {
        calls++;
        return Promise.resolve({ status: 200 });
      },
    });
    assert.equal(result.delivered, true);
    assert.equal(result.attempts, 0);
    assert.equal(calls, 0);
  });

  void it("rejects oversized signed payloads before transport", () => {
    assert.throws(() =>
      buildSignedWebhookRequest(
        { ...input, payload: { value: "x".repeat(300_000) } },
        "secret",
        1,
      ),
    );
  });

  void it("reports stable typed errors for invalid signing configuration", () => {
    assert.throws(
      () => buildSignedWebhookRequest(input, "", 1),
      (error: unknown) =>
        error instanceof WebhookDeliveryError && error.code === "INVALID_SECRET",
    );
  });

  void it("delivers matching and wildcard subscribers independently", async () => {
    webhookStore.set("webhook_matching", {
      url: "https://example.test/matching",
      events: ["charge.created"],
      createdAt: 1,
    });
    webhookStore.set("webhook_wildcard", {
      url: "https://example.test/wildcard",
      events: ["*"],
      createdAt: 2,
    });
    webhookSecretStore.set("webhook_matching", { secret: "matching-secret", createdAt: 1 });
    webhookSecretStore.set("webhook_wildcard", { secret: "wildcard-secret", createdAt: 2 });
    const urls: string[] = [];

    const results = await deliverEventToWebhooks(
      "charge.created",
      { chargeId: "charge_2" },
      {
        sleep: () => Promise.resolve(),
        transport: (url, request) => {
          urls.push(url);
          assert.equal(request.method, "POST");
          assert.equal(request.headers["Content-Type"], "application/json");
          assert.equal(
            verifyWebhookSignature(
              request.body,
              url.endsWith("matching") ? "matching-secret" : "wildcard-secret",
              Number(request.headers["X-Signature-Timestamp"]),
              request.headers["X-Signature"],
            ),
            true,
          );
          return Promise.resolve({ status: 202 });
        },
      },
    );

    assert.equal(results.length, 2);
    assert.deepEqual(urls.sort(), [
      "https://example.test/matching",
      "https://example.test/wildcard",
    ]);
    assert.equal(webhookDeliveredStore.size, 2);
  });
});
