import { describe, it, expect } from "vitest";
import { requestBodySchemas } from "./schemas/requestBodies.js";

describe("payment schema validation", () => {
  it("accepts a valid charge payload", () => {
    const result = requestBodySchemas.chargeCreate.parse({
      amount: 1000,
      currency: "USD",
      source: "invoice-123",
    });
    expect(result.ok).toBe(true);
  });

  it("rejects missing amount with field-level detail", () => {
    const result = requestBodySchemas.chargeCreate.parse({
      currency: "USD",
      source: "invoice-123",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.details).toBeDefined();
      expect(result.details!.some((d) => d.field === "amount")).toBe(true);
    }
  });

  it("rejects negative amount", () => {
    const result = requestBodySchemas.chargeCreate.parse({
      amount: -5,
      currency: "USD",
      source: "invoice-123",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects invalid currency format", () => {
    const result = requestBodySchemas.chargeCreate.parse({
      amount: 100,
      currency: "usdc",
      source: "invoice-123",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.details!.some((d) => d.field === "currency")).toBe(true);
    }
  });

  it("rejects source longer than 256 chars", () => {
    const result = requestBodySchemas.chargeCreate.parse({
      amount: 100,
      currency: "USD",
      source: "x".repeat(257),
    });
    expect(result.ok).toBe(false);
  });

  it("rejects description longer than 500 chars", () => {
    const result = requestBodySchemas.chargeCreate.parse({
      amount: 100,
      currency: "USD",
      source: "invoice-123",
      description: "x".repeat(501),
    });
    expect(result.ok).toBe(false);
  });

  it("rejects unknown fields with details", () => {
    const result = requestBodySchemas.chargeCreate.parse({
      amount: 100,
      currency: "USD",
      source: "invoice-123",
      extra: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.details).toBeDefined();
      expect(result.details![0].field).toBe("extra");
    }
  });

  it("accepts a valid settle payload", () => {
    const result = requestBodySchemas.settle.parse({
      agent: "agent-1",
      serviceId: "svc-1",
    });
    expect(result.ok).toBe(true);
  });

  it("rejects settle payload missing serviceId", () => {
    const result = requestBodySchemas.settle.parse({ agent: "agent-1" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.details!.some((d) => d.field === "serviceId")).toBe(true);
    }
  });
});
