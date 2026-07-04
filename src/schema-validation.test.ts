import assert from "node:assert";
import { describe, it } from "node:test";
import request from "supertest";
import { createApp } from "./index.js";
import {
  openApiRequestBodyComponents,
  requestBodySchemas,
} from "./schemas/requestBodies.js";

type SchemaName = keyof typeof requestBodySchemas;

const expectedSchemaKeys = [
  "apiKeyCreate",
  "bulkServices",
  "bulkUsage",
  "configPatch",
  "serviceCreate",
  "serviceDisabledPatch",
  "serviceMetadataPut",
  "servicePricePatch",
  "settle",
  "usageRecord",
  "webhookCreate",
  "webhookPatch",
].sort();

const schemaExamples: {
  name: SchemaName;
  valid: unknown;
  invalid: unknown;
  invalidMessage: RegExp;
}[] = [
  {
    name: "apiKeyCreate",
    valid: { label: "integration key" },
    invalid: { label: "" },
    invalidMessage: /label must be a non-empty string up to 64 chars/,
  },
  {
    name: "bulkServices",
    valid: { items: [{ serviceId: "svc-a", priceStroops: 1 }] },
    invalid: { items: [] },
    invalidMessage: /items must be 1-50 entries/,
  },
  {
    name: "bulkUsage",
    valid: { items: [{ agent: "agent-a", serviceId: "svc-a", requests: 1 }] },
    invalid: { items: Array.from({ length: 101 }, () => ({})) },
    invalidMessage: /items must be a non-empty array of up to 100 entries/,
  },
  {
    name: "configPatch",
    valid: { rateLimitPerWindow: 10, rateLimitWindowMs: 1000, bulkMaxItems: 25 },
    invalid: { rateLimitPerWindow: 0 },
    invalidMessage: /rateLimitPerWindow must be a positive integer/,
  },
  {
    name: "serviceCreate",
    valid: { serviceId: "svc-a", priceStroops: 0 },
    invalid: { serviceId: "", priceStroops: 0 },
    invalidMessage: /serviceId must be a non-empty string up to 128 chars/,
  },
  {
    name: "serviceDisabledPatch",
    valid: { disabled: true },
    invalid: { disabled: "true" },
    invalidMessage: /disabled must be a boolean/,
  },
  {
    name: "serviceMetadataPut",
    valid: { description: "Service description", owner: "owner-a" },
    invalid: { description: "Service description", owner: "" },
    invalidMessage: /owner must be a non-empty string up to 256 chars/,
  },
  {
    name: "servicePricePatch",
    valid: { priceStroops: 3 },
    invalid: { priceStroops: -1 },
    invalidMessage: /priceStroops must be a non-negative integer/,
  },
  {
    name: "settle",
    valid: { agent: "agent-a", serviceId: "svc-a" },
    invalid: { agent: "agent-a" },
    invalidMessage: /agent and serviceId are required strings/,
  },
  {
    name: "usageRecord",
    valid: { agent: "agent-a", serviceId: "svc-a", requests: 1 },
    invalid: { agent: "agent-a", serviceId: "svc-a", requests: 1.5 },
    invalidMessage: /requests must be a positive integer/,
  },
  {
    name: "webhookCreate",
    valid: { url: "https://example.com/hook", events: ["usage.recorded"] },
    invalid: { url: "ftp://example.com/hook", events: ["usage.recorded"] },
    invalidMessage: /url must be an http\(s\) URL up to 2048 chars/,
  },
  {
    name: "webhookPatch",
    valid: { events: ["usage.recorded"] },
    invalid: { events: [] },
    invalidMessage: /events must be a non-empty array of strings/,
  },
];

void describe("schema-first request validation", () => {
  void it("defines a request body schema for every body-bearing route", () => {
    assert.deepStrictEqual(Object.keys(requestBodySchemas).sort(), expectedSchemaKeys);
    assert.deepStrictEqual(
      Object.keys(openApiRequestBodyComponents).sort(),
      expectedSchemaKeys
    );
  });

  void it("publishes OpenAPI request body refs from the shared schema registry", async () => {
    const res = await request(createApp()).get("/api/v1/openapi.json");
    assert.strictEqual(res.status, 200);

    const schemas = res.body.components?.schemas ?? {};
    for (const key of expectedSchemaKeys) {
      assert.ok(schemas[key], `missing OpenAPI component for ${key}`);
    }

    assert.strictEqual(
      res.body.paths["/api/v1/services"].post.requestBody.content["application/json"]
        .schema.$ref,
      "#/components/schemas/serviceCreate"
    );
    assert.strictEqual(
      res.body.paths["/api/v1/config"].patch.requestBody.content["application/json"]
        .schema.$ref,
      "#/components/schemas/configPatch"
    );
  });

  void it("validates representative valid and invalid bodies for every schema", () => {
    assert.strictEqual(schemaExamples.length, expectedSchemaKeys.length);

    for (const example of schemaExamples) {
      const valid = requestBodySchemas[example.name].parse(example.valid);
      assert.strictEqual(valid.ok, true, `${example.name} valid sample failed`);

      const invalid = requestBodySchemas[example.name].parse(example.invalid);
      assert.strictEqual(invalid.ok, false, `${example.name} invalid sample passed`);
      if (!invalid.ok) assert.match(invalid.message, example.invalidMessage);
    }
  });

  void it("rejects extra request body fields with the standard error envelope", async () => {
    const res = await request(createApp())
      .post("/api/v1/services")
      .set("X-Request-Id", "schema-extra-field")
      .send({
        serviceId: "svc-schema-extra",
        priceStroops: 10,
        unexpected: true,
      });

    assert.strictEqual(res.status, 400);
    const body = res.body as { error: string; requestId: string; message: string };
    assert.strictEqual(body.error, "invalid_request");
    assert.strictEqual(body.requestId, "schema-extra-field");
    assert.match(body.message, /unexpected field: unexpected/);
  });
});
