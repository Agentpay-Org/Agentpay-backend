import assert from "node:assert";
import { describe, it } from "node:test";
import request from "supertest";
import { app } from "./index.js";
import { parseIntParam } from "./queryParams.js";

void describe("numeric query parameter parsing", () => {
  void it("falls back and clamps numeric query parameters", () => {
    const options = { defaultValue: 10, min: 1, max: 100 };

    assert.strictEqual(parseIntParam(undefined, options), 10);
    assert.strictEqual(parseIntParam("abc", options), 10);
    assert.strictEqual(parseIntParam("NaN", options), 10);
    assert.strictEqual(parseIntParam("Infinity", options), 10);
    assert.strictEqual(parseIntParam("0", options), 1);
    assert.strictEqual(parseIntParam("-5", options), 1);
    assert.strictEqual(parseIntParam("250", options), 100);
    assert.strictEqual(parseIntParam("3.7", options), 3);
  });

  void it("falls back to the default limit on agent lists", async () => {
    await request(app)
      .post("/api/v1/usage")
      .send({ agent: "qp-agent-a", serviceId: "qp-service", requests: 1 });
    await request(app)
      .post("/api/v1/usage")
      .send({ agent: "qp-agent-b", serviceId: "qp-service", requests: 1 });

    const fallback = await request(app).get("/api/v1/agents?limit=abc");
    const clamped = await request(app).get("/api/v1/agents?limit=0");

    assert.strictEqual(fallback.status, 200);
    assert.ok(fallback.body.agents.includes("qp-agent-a"));
    assert.ok(fallback.body.agents.includes("qp-agent-b"));
    assert.strictEqual(clamped.body.agents.length, 1);
  });

  void it("falls back to the default limit on top service-agent lists", async () => {
    await request(app)
      .post("/api/v1/usage")
      .send({ agent: "qp-top-a", serviceId: "qp-top-service", requests: 5 });
    await request(app)
      .post("/api/v1/usage")
      .send({ agent: "qp-top-b", serviceId: "qp-top-service", requests: 3 });

    const fallback = await request(app).get(
      "/api/v1/services/qp-top-service/agents/top?limit=abc"
    );

    assert.strictEqual(fallback.status, 200);
    assert.deepStrictEqual(
      fallback.body.items.map((item: { agent: string }) => item.agent),
      ["qp-top-a", "qp-top-b"]
    );
  });

  void it("falls back to since=0 instead of hiding every event", async () => {
    await request(app)
      .post("/api/v1/usage")
      .send({ agent: "qp-event-agent", serviceId: "qp-event-service", requests: 1 });

    const res = await request(app).get("/api/v1/events?since=abc&limit=100");

    assert.strictEqual(res.status, 200);
    assert.ok(
      res.body.items.some(
        (item: { type: string; payload?: { agent?: string } }) =>
          item.type === "usage.recorded" && item.payload?.agent === "qp-event-agent"
      )
    );
  });
});
