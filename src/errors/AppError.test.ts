import { describe, it } from "node:test";
import assert from "node:assert";
import express, { type NextFunction, type Request, type Response } from "express";
import request from "supertest";
import {
  AppError,
  asyncHandler,
  renderAppError,
  renderInternalError,
} from "./AppError.js";

function bodyFor(error: AppError) {
  const app = express();
  app.use((req: Request, _res: Response, next) => {
    req.id = "app-error-test";
    next();
  });
  app.get("/error", (_req, res) => {
    renderAppError(error, _req, res);
  });
  return request(app).get("/error");
}

void describe("AppError", () => {
  void it("badRequest renders the existing invalid_request envelope", async () => {
    const res = await bodyFor(AppError.badRequest("bad input"));
    assert.strictEqual(res.status, 400);
    assert.deepStrictEqual(res.body, {
      error: "invalid_request",
      message: "bad input",
      requestId: "app-error-test",
    });
  });

  void it("notFound renders the existing not_found envelope", async () => {
    const res = await bodyFor(AppError.notFound("missing"));
    assert.strictEqual(res.status, 404);
    assert.deepStrictEqual(res.body, {
      error: "not_found",
      message: "missing",
      requestId: "app-error-test",
    });
  });

  void it("conflict preserves the service_disabled code", async () => {
    const res = await bodyFor(AppError.conflict("disabled"));
    assert.strictEqual(res.status, 409);
    assert.deepStrictEqual(res.body, {
      error: "service_disabled",
      message: "disabled",
      requestId: "app-error-test",
    });
  });

  void it("paused renders the existing 503 envelope", async () => {
    const res = await bodyFor(AppError.paused("paused"));
    assert.strictEqual(res.status, 503);
    assert.deepStrictEqual(res.body, {
      error: "service_paused",
      message: "paused",
      requestId: "app-error-test",
    });
  });

  void it("payloadTooLarge renders the existing 413 envelope", async () => {
    const res = await bodyFor(AppError.payloadTooLarge("too large"));
    assert.strictEqual(res.status, 413);
    assert.deepStrictEqual(res.body, {
      error: "payload_too_large",
      message: "too large",
      requestId: "app-error-test",
    });
  });

  void it("rateLimited renders the existing 429 envelope", async () => {
    const res = await bodyFor(AppError.rateLimited("too many"));
    assert.strictEqual(res.status, 429);
    assert.deepStrictEqual(res.body, {
      error: "rate_limited",
      message: "too many",
      requestId: "app-error-test",
    });
  });

  void it("asyncHandler forwards thrown AppErrors", async () => {
    const app = express();
    app.use((req: Request, _res: Response, next) => {
      req.id = "async-handler-test";
      next();
    });
    app.get(
      "/wrapped",
      asyncHandler(() => {
        throw AppError.notFound("wrapped missing");
      })
    );
    app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
      assert.ok(err instanceof AppError);
      renderAppError(err, req, res);
    });

    const res = await request(app).get("/wrapped");
    assert.strictEqual(res.status, 404);
    assert.deepStrictEqual(res.body, {
      error: "not_found",
      message: "wrapped missing",
      requestId: "async-handler-test",
    });
  });

  void it("renderInternalError keeps the existing 500 envelope", async () => {
    const app = express();
    app.use((req: Request, _res: Response, next) => {
      req.id = "internal-error-test";
      next();
    });
    app.get("/boom", (req, res) => {
      renderInternalError(new Error("boom"), req, res);
    });

    const res = await request(app).get("/boom");
    assert.strictEqual(res.status, 500);
    assert.deepStrictEqual(res.body, {
      error: "internal_error",
      message: "boom",
      method: "GET",
      path: "/boom",
      requestId: "internal-error-test",
    });
  });
});
