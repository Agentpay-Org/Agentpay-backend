import { Router, type NextFunction, type Request, type Response } from "express";
import { recordEvent } from "../events.js";
import {
  chargeFingerprint,
  InMemoryChargeIdempotencyStore,
  InMemoryChargeStore,
  validateIdempotencyKey,
} from "../charges.js";
import { resolveTenantId } from "../tenant.js";
import {
  paymentConflictError,
  paymentInProgressError,
  paymentNotFoundError,
  paymentRequestId,
  paymentValidationError,
} from "../errors/domainError.js";
import { paymentErrorHandler } from "../middleware/paymentErrorHandler.js";
import { validateBody } from "../middleware/validate.js";
import { requestBodySchemas } from "../schemas/requestBodies.js";

export type ChargesRouterOptions = {
  idempotencyStore?: InMemoryChargeIdempotencyStore;
  chargeStore?: InMemoryChargeStore;
};

export function createChargesRouter(options: ChargesRouterOptions = {}): Router {
  const router = Router();
  const idempotencyStore =
    options.idempotencyStore ?? new InMemoryChargeIdempotencyStore();
  const chargeStore = options.chargeStore ?? new InMemoryChargeStore();

  router.post(
    "/api/v1/charges",
    validateBody(requestBodySchemas.chargeCreate),
    (req: Request, res: Response, next: NextFunction) => {
      const requestId = paymentRequestId(req);
      const tenantId = resolveTenantId(req);
      const parsed = { ok: true as const, value: req.body };

    const suppliedKey = req.header("idempotency-key");
    if (
      suppliedKey !== undefined &&
      validateIdempotencyKey(suppliedKey) === undefined
    ) {
      next(paymentValidationError("Idempotency-Key must be 1-255 safe characters"));
      return;
    }
    const key = validateIdempotencyKey(suppliedKey);
    if (!key) {
      const charge = chargeStore.create(tenantId, parsed.value);
      recordEvent("billing.charge_created", { chargeId: charge.id, tenantId });
      res.status(201).json({ charge, requestId });
      return;
    }

    const fingerprint = chargeFingerprint(tenantId, req.method, req.path, parsed.value);
    const claim = idempotencyStore.claim(tenantId, key, fingerprint);
    if (claim.kind === "conflict") {
      next(
        paymentConflictError(
          "Idempotency-Key was already used with a different request body or route"
        )
      );
      return;
    }
    if (claim.kind === "in_progress") {
      next(
        paymentInProgressError(
          "A payment request with this Idempotency-Key is in progress"
        )
      );
      return;
    }
    if (claim.kind === "replay") {
      res.setHeader("Idempotency-Replayed", "true");
      res.status(claim.response.statusCode).json(claim.response.body);
      return;
    }

    try {
      const charge = chargeStore.create(tenantId, parsed.value);
      const body = { charge, requestId };
      idempotencyStore.complete(claim.record, { statusCode: 201, body });
      recordEvent("billing.charge_created", {
        chargeId: charge.id,
        tenantId,
        idempotent: true,
      });
      res.status(201).json(body);
    } catch (error) {
      idempotencyStore.release(claim.record);
      next(error);
    }
  });

  router.get("/api/v1/charges", (req: Request, res: Response) => {
    const tenantId = resolveTenantId(req);
    res
      .status(200)
      .json({ charges: chargeStore.list(tenantId), requestId: paymentRequestId(req) });
  });

  router.get(
    "/api/v1/charges/:chargeId",
    (req: Request, res: Response, next: NextFunction) => {
      const tenantId = resolveTenantId(req);
      const chargeId = String(req.params.chargeId);
      const charge = chargeStore.get(tenantId, chargeId);
      if (!charge) {
        next(paymentNotFoundError(`charge ${chargeId} is not registered`));
        return;
      }
      res.status(200).json({ charge, requestId: paymentRequestId(req) });
    }
  );

  router.use(paymentErrorHandler);

  return router;
}
