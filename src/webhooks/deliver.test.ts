import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert";
import http from "node:http";
import express from "express";
import request from "supertest";
import { recordEvent, eventLog } from "../events.js";
import { createWebhooksRouter } from "../routes/webhooks.js";
import { webhookStore } from "../store/state.js";
import { verifyWebhookSignature } from "./deliver.js";

type ReceivedRequest = {
  body: string;
  headers: http.IncomingHttpHeaders;
};

const waitFor = async (predicate: () => boolean) => {
  for (let i = 0; i < 50; i++) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("condition was not met");
};

const createWebhookApp = () => {
  const app = express();
  app.use(express.json());
  app.use(createWebhooksRouter());
  return app;
};

const readCreatedWebhook = (body: unknown) => {
  if (
    typeof body !== "object" ||
    body === null ||
    !("id" in body) ||
    !("secret" in body)
  ) {
    throw new TypeError("expected webhook creation response");
  }
  const { id, secret } = body as { id: unknown; secret: unknown };
  if (typeof id !== "string" || typeof secret !== "string") {
    throw new TypeError("expected webhook id and secret to be strings");
  }
  return { id, secret };
};

const startReceiver = async (statuses: number[]) => {
  const received: ReceivedRequest[] = [];
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      received.push({
        body: Buffer.concat(chunks).toString("utf8"),
        headers: req.headers,
      });
      res.statusCode = statuses.shift() ?? 200;
      res.end("ok");
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("expected TCP server address");
  }
  return {
    url: `http://127.0.0.1:${address.port}/hook`,
    received,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
};

beforeEach(() => {
  webhookStore.clear();
  eventLog.length = 0;
  process.env.ALLOW_PRIVATE_WEBHOOKS = "true";
});

afterEach(() => {
  delete process.env.ALLOW_PRIVATE_WEBHOOKS;
});

void describe("signed webhook delivery", () => {
  void it("returns a secret once and hides it from list responses", async () => {
    const app = createWebhookApp();
    const receiver = await startReceiver([200]);

    try {
      const created = await request(app)
        .post("/api/v1/webhooks")
        .send({ url: receiver.url, events: ["usage.recorded"] })
        .expect(201);
      const { secret } = readCreatedWebhook(created.body);

      assert.match(secret, /^whsec_/);

      const listed = await request(app).get("/api/v1/webhooks").expect(200);
      assert.strictEqual(listed.body.items[0].secret, undefined);
      assert.strictEqual(listed.body.items[0].deadLetters, 0);
    } finally {
      await receiver.close();
    }
  });

  void it("delivers matching events with HMAC signatures", async () => {
    const app = createWebhookApp();
    const receiver = await startReceiver([200]);

    try {
      const created = await request(app)
        .post("/api/v1/webhooks")
        .send({ url: receiver.url, events: ["usage.recorded"] })
        .expect(201);
      const { secret } = readCreatedWebhook(created.body);

      recordEvent("usage.recorded", {
        agent: "agent-webhook",
        serviceId: "svc-webhook",
        requests: 2,
        total: 2,
      });

      await waitFor(() => receiver.received.length === 1);
      const delivered = receiver.received[0];
      assert.strictEqual(delivered.headers["x-agentpay-event"], "usage.recorded");
      assert.strictEqual(
        verifyWebhookSignature(
          secret,
          delivered.body,
          delivered.headers["x-agentpay-signature"] as string
        ),
        true
      );
      assert.strictEqual(JSON.parse(delivered.body).payload.requests, 2);
    } finally {
      await receiver.close();
    }
  });

  void it("retries 5xx deliveries before succeeding", async () => {
    const app = createWebhookApp();
    const receiver = await startReceiver([500, 502, 200]);

    try {
      const created = await request(app)
        .post("/api/v1/webhooks")
        .send({ url: receiver.url, events: ["*"] })
        .expect(201);
      const { id } = readCreatedWebhook(created.body);

      const tested = await request(app).post(`/api/v1/webhooks/${id}/test`).expect(200);

      assert.strictEqual(tested.body.delivered, true);
      assert.strictEqual(tested.body.attempts, 3);
      assert.strictEqual(receiver.received.length, 3);
      assert.strictEqual(webhookStore.get(id)?.deadLetters, 0);
    } finally {
      await receiver.close();
    }
  });

  void it("increments deadLetters after permanent 4xx failures", async () => {
    const app = createWebhookApp();
    const receiver = await startReceiver([404]);

    try {
      const created = await request(app)
        .post("/api/v1/webhooks")
        .send({ url: receiver.url, events: ["usage.recorded"] })
        .expect(201);
      const { id } = readCreatedWebhook(created.body);

      const tested = await request(app).post(`/api/v1/webhooks/${id}/test`).expect(200);

      assert.strictEqual(tested.body.delivered, false);
      assert.strictEqual(tested.body.status, 404);
      assert.strictEqual(webhookStore.get(id)?.deadLetters, 1);
    } finally {
      await receiver.close();
    }
  });

  void it("blocks private webhook targets unless explicitly allowed", async () => {
    delete process.env.ALLOW_PRIVATE_WEBHOOKS;
    const app = createWebhookApp();

    const created = await request(app)
      .post("/api/v1/webhooks")
      .send({ url: "http://127.0.0.1:1/hook", events: ["usage.recorded"] })
      .expect(201);
    const { id } = readCreatedWebhook(created.body);

    const tested = await request(app).post(`/api/v1/webhooks/${id}/test`).expect(200);
    const error = tested.body.error as unknown;
    if (typeof error !== "string") {
      throw new TypeError("expected delivery error string");
    }

    assert.strictEqual(tested.body.delivered, false);
    assert.match(error, /private webhook targets/);
    assert.strictEqual(webhookStore.get(id)?.deadLetters, 1);
  });
});
