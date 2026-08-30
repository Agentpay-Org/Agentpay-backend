import assert from "node:assert/strict";
import express, { type Request } from "express";
import request from "supertest";
import { describe, it } from "node:test";
import {
  PaymentDomainError,
  paymentConflictError,
  paymentInternalError,
  paymentNotFoundError,
  paymentRequestId,
  paymentValidationError,
} from "./errors/domainError.js";
import { InMemoryChargeIdempotencyStore, InMemoryChargeStore } from "./charges.js";
import { createChargesRouter } from "./routes/charges.js";

const validCharge = {
  amount: 1200,
  currency: "USD",
  source: "acct_payment_errors",
};

function paymentApp(
  chargeStore = new InMemoryChargeStore(),
  requestIdMiddleware = true
) {
  const app = express();
  app.use(express.json());
  if (requestIdMiddleware) {
    app.use((req, _res, next) => {
      (req as Request & { id?: string }).id = "middleware-request-id";
      next();
    });
  }
  app.use((req, _res, next) => {
    const apiKey = req.header("x-api-key");
    if (apiKey) (req as Request & { apiKeyHash?: string }).apiKeyHash = apiKey;
    next();
  });
  app.use(
    createChargesRouter({
      chargeStore,
      idempotencyStore: new InMemoryChargeIdempotencyStore(),
    })
  );
  return app;
}

function assertStableError(
  body: unknown,
  expectedCode: string,
  expectedMessage: string,
  expectedRequestId: string
) {
  assert.deepEqual(body, {
    code: expectedCode,
    error: expectedCode,
    message: expectedMessage,
    requestId: expectedRequestId,
  });
}

void describe("payment domain error taxonomy", () => {
  void it("exposes only the safe public fields on a validation error", () => {
    const error = paymentValidationError(
      "amount must be positive",
      new Error("db detail")
    );
    assert.ok(error instanceof PaymentDomainError);
    assert.equal(error.code, "invalid_request");
    assert.equal(error.status, 400);
    assert.equal(error.message, "amount must be positive");
    assert.equal(error.cause instanceof Error, true);
  });

  void it("assigns exactly one status to each public factory", () => {
    assert.deepEqual(
      [
        paymentValidationError("bad"),
        paymentNotFoundError("missing"),
        paymentConflictError("conflict"),
        paymentInternalError(new Error("private")),
      ].map((error) => ({ code: error.code, status: error.status })),
      [
        { code: "invalid_request", status: 400 },
        { code: "not_found", status: 404 },
        { code: "idempotency_conflict", status: 409 },
        { code: "internal_error", status: 500 },
      ]
    );
  });

  void it("uses middleware, then header, then a safe test fallback for request ids", () => {
    const withMiddleware = {
      id: "from-middleware",
      header: () => undefined,
    } as unknown as Request;
    const withHeader = {
      header: (name: string) => (name === "x-request-id" ? "from-header" : undefined),
    } as unknown as Request;
    const withoutEither = { header: () => undefined } as unknown as Request;

    assert.equal(paymentRequestId(withMiddleware), "from-middleware");
    assert.equal(paymentRequestId(withHeader), "from-header");
    assert.equal(paymentRequestId(withoutEither), "unknown-request");
  });
});

void describe("central payment error middleware", () => {
  void it("maps validation failures to the stable 400 envelope", async () => {
    const response = await request(paymentApp())
      .post("/api/v1/charges")
      .set("X-Request-Id", "validation-request")
      .send({ ...validCharge, amount: 0 });

    assert.equal(response.status, 400);
    assertStableError(
      response.body,
      "invalid_request",
      "amount must be a positive safe integer",
      "middleware-request-id"
    );
  });

  void it("uses the same 400 envelope for a missing or non-object body", async () => {
    const missing = await request(paymentApp())
      .post("/api/v1/charges")
      .set("X-Request-Id", "missing-body-request")
      .send();
    const arrayBody = await request(paymentApp())
      .post("/api/v1/charges")
      .set("X-Request-Id", "array-body-request")
      .send([]);

    assert.equal(missing.status, 400);
    assert.equal(arrayBody.status, 400);
    assert.equal(missing.body.code, "invalid_request");
    assert.equal(arrayBody.body.code, "invalid_request");
    assert.equal(missing.body.requestId, "middleware-request-id");
    assert.equal(arrayBody.body.requestId, "middleware-request-id");
    assert.equal(Object.hasOwn(missing.body as object, "stack"), false);
    assert.equal(Object.hasOwn(arrayBody.body as object, "cause"), false);
  });

  void it("maps malformed idempotency keys before reserving a payment", async () => {
    const idempotencyStore = new InMemoryChargeIdempotencyStore();
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as Request & { id?: string }).id = "malformed-key-request";
      next();
    });
    app.use(
      createChargesRouter({
        idempotencyStore,
        chargeStore: new InMemoryChargeStore(),
      })
    );

    const response = await request(app)
      .post("/api/v1/charges")
      .set("Idempotency-Key", "contains spaces")
      .send(validCharge);

    assert.equal(response.status, 400);
    assertStableError(
      response.body,
      "invalid_request",
      "Idempotency-Key must be 1-255 safe characters",
      "malformed-key-request"
    );
    assert.equal(idempotencyStore.size(), 0);
  });

  void it("maps an unknown charge to the stable 404 envelope", async () => {
    const response = await request(paymentApp())
      .get("/api/v1/charges/ch_missing")
      .set("X-Request-Id", "not-found-request");

    assert.equal(response.status, 404);
    assertStableError(
      response.body,
      "not_found",
      "charge ch_missing is not registered",
      "middleware-request-id"
    );
  });

  void it("maps an idempotency conflict without exposing fingerprint data", async () => {
    const app = paymentApp();
    await request(app)
      .post("/api/v1/charges")
      .set("Idempotency-Key", "payment-conflict")
      .send(validCharge);
    const response = await request(app)
      .post("/api/v1/charges")
      .set("Idempotency-Key", "payment-conflict")
      .send({ ...validCharge, amount: 1300 });

    assert.equal(response.status, 409);
    assert.equal(response.body.code, "idempotency_conflict");
    assert.equal(response.body.requestId, "middleware-request-id");
    assert.equal(JSON.stringify(response.body).includes("1300"), false);
    assert.equal(JSON.stringify(response.body).includes("fingerprint"), false);
  });

  void it("maps an in-progress idempotency claim to the same 409 family", async () => {
    const idempotencyStore = new InMemoryChargeIdempotencyStore();
    idempotencyStore.claim("api:public", "payment-busy", "different-fingerprint");
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as Request & { apiKeyHash?: string; id?: string }).apiKeyHash = "public";
      (req as Request & { id?: string }).id = "busy-request";
      next();
    });
    app.use(
      createChargesRouter({
        idempotencyStore,
        chargeStore: new InMemoryChargeStore(),
      })
    );

    const response = await request(app)
      .post("/api/v1/charges")
      .set("Idempotency-Key", "payment-busy")
      .send(validCharge);

    assert.equal(response.status, 409);
    assertStableError(
      response.body,
      "idempotency_conflict",
      "Idempotency-Key was already used with a different request body or route",
      "busy-request"
    );
  });

  void it("maps unexpected handler failures to 500 without leaking internals", async () => {
    class ThrowingChargeStore extends InMemoryChargeStore {
      override get(): undefined {
        throw new Error("database password at /srv/private/payments.db");
      }
    }
    const response = await request(paymentApp(new ThrowingChargeStore()))
      .get("/api/v1/charges/ch_broken")
      .set("X-Request-Id", "internal-request");

    assert.equal(response.status, 500);
    assertStableError(
      response.body,
      "internal_error",
      "Unexpected payment processing error",
      "middleware-request-id"
    );
    assert.equal(JSON.stringify(response.body).includes("database password"), false);
    assert.equal(JSON.stringify(response.body).includes("/srv/private"), false);
    assert.equal(JSON.stringify(response.body).includes("stack"), false);
  });

  void it("returns a tenant-scoped charge using the same request correlation field", async () => {
    const app = paymentApp(undefined, false);
    const created = await request(app)
      .post("/api/v1/charges")
      .set("X-API-Key", "tenant-a")
      .set("X-Request-Id", "create-request")
      .send(validCharge);
    const response = await request(app)
      .get(`/api/v1/charges/${created.body.charge.id}`)
      .set("X-API-Key", "tenant-a")
      .set("X-Request-Id", "lookup-request");

    assert.equal(response.status, 200);
    assert.equal(response.body.charge.id, created.body.charge.id);
    assert.equal(response.body.requestId, "lookup-request");
  });

  void it("includes a request id on successful list responses for embedded routers", async () => {
    const app = paymentApp(undefined, false);
    const response = await request(app)
      .get("/api/v1/charges")
      .set("X-Request-Id", "list-request");

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      charges: [],
      requestId: "list-request",
    });
  });

  void it("replays the original safe error envelope with its original request id", async () => {
    const app = paymentApp();
    const first = await request(app)
      .post("/api/v1/charges")
      .set("Idempotency-Key", "error-replay")
      .set("X-Request-Id", "first-error-request")
      .send({ ...validCharge, amount: -1 });
    const second = await request(app)
      .post("/api/v1/charges")
      .set("Idempotency-Key", "error-replay")
      .set("X-Request-Id", "second-error-request")
      .send({ ...validCharge, amount: -1 });

    assert.equal(first.status, 400);
    assert.equal(second.status, 400);
    assert.equal(second.body.code, "invalid_request");
    assert.equal(second.body.requestId, "middleware-request-id");
    assert.equal(JSON.stringify(second.body).includes("first-error-request"), false);
  });

  void it("does not reveal another tenant's charge through the not-found path", async () => {
    const app = paymentApp(undefined, false);
    const created = await request(app)
      .post("/api/v1/charges")
      .set("X-API-Key", "tenant-a")
      .send(validCharge);
    const response = await request(app)
      .get(`/api/v1/charges/${created.body.charge.id}`)
      .set("X-API-Key", "tenant-b")
      .set("X-Request-Id", "cross-tenant-request");

    assert.equal(response.status, 404);
    assert.equal(response.body.code, "not_found");
    assert.equal(response.body.requestId, "cross-tenant-request");
  });
});
