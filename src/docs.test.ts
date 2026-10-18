import { describe, it } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { app } from "./index.js";

void describe("root index and docs", () => {
  void it("GET / describes the API", async () => {
    const res = await request(app).get("/");
    assert.equal(res.status, 200);
    assert.equal(res.body.docs, "/docs");
    assert.ok(res.body.endpoints["GET /health"]);
  });

  void it("GET /docs serves HTML", async () => {
    const res = await request(app).get("/docs");
    assert.equal(res.status, 200);
    assert.match(res.text, /swagger-ui/);
  });

  void it("GET /health returns 200", async () => {
    const res = await request(app).get("/health");
    assert.equal(res.status, 200);
  });
});
