import assert from "node:assert";
import { describe, it } from "node:test";
import request from "supertest";
import { app } from "./index.js";
import { escapeCsvField } from "./routes/usage.js";

void describe("CSV formula injection mitigation", () => {
  void it("neutralizes formula-leading fields before CSV quoting", () => {
    assert.strictEqual(escapeCsvField("=cmd"), "'=cmd");
    assert.strictEqual(escapeCsvField("+1"), "'+1");
    assert.strictEqual(escapeCsvField("-1"), "'-1");
    assert.strictEqual(escapeCsvField("@ref"), "'@ref");
    assert.strictEqual(escapeCsvField("\tTabbed"), "'\tTabbed");
    assert.strictEqual(escapeCsvField("\rCarriage"), `"'\rCarriage"`);
    assert.strictEqual(escapeCsvField('="quoted"'), `"'=""quoted"""`);
    assert.strictEqual(escapeCsvField("normal"), "normal");
    assert.strictEqual(escapeCsvField("needs,quote"), '"needs,quote"');
  });

  void it("neutralizes usage CSV exports without changing JSON exports", async () => {
    await request(app)
      .post("/api/v1/usage")
      .send({ agent: "=cmd", serviceId: "@svc", requests: 1 });

    const csv = await request(app).get("/api/v1/usage/export.csv");
    assert.strictEqual(csv.status, 200);
    assert.ok(csv.headers["content-type"].startsWith("text/csv"));
    assert.match(csv.text, /^'=cmd,'@svc,1$/m);

    const json = await request(app).get("/api/v1/usage/export.json");
    assert.strictEqual(json.status, 200);
    assert.ok(
      json.body.items.some(
        (item: { agent: string; serviceId: string; total: number }) =>
          item.agent === "=cmd" && item.serviceId === "@svc" && item.total >= 1
      )
    );
  });
});
