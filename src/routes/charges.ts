import { Router, type Request, type Response } from "express";
import { recordEvent } from "../events.js";
import {
  chargeFingerprint,
  InMemoryChargeIdempotencyStore,
  InMemoryChargeStore,
  validateChargeInput,
  validateIdempotencyKey,
} from "../charges.js";
import { resolveTenantId } from "../tenant.js";
import { getRequestId } from "../types.js";

export type ChargesRouterOptions = {
  idempotencyStore?: InMemoryChargeIdempotencyStore;
  chargeStore?: InMemoryChargeStore;
};

export function createChargesRouter(options: ChargesRouterOptions = {}): Router {
  const router = Router();
  const idempotencyStore = options.idempotencyStore ?? new InMemoryChargeIdempotencyStore();
  const chargeStore = options.chargeStore ?? new InMemoryChargeStore();

  router.post("/api/v1/charges", (req: Request, res: Response) => {
    const requestId = getRequestId(req);
    const tenantId = resolveTenantId(req);
    const parsed = validateChargeInput(req.body);
    if (!parsed.ok) {
      res.status(400).json({ error: "invalid_request", message: parsed.message, requestId });
      return;
    }

    const suppliedKey = req.header("idempotency-key");
    if (suppliedKey !== undefined && validateIdempotencyKey(suppliedKey) === undefined) {
      res.status(400).json({
        error: "invalid_request",
        message: "Idempotency-Key must be 1-255 safe characters",
        requestId,
      });
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
      res.status(409).json({ error: "idempotency_conflict", requestId });
      return;
    }
    if (claim.kind === "in_progress") {
      res.status(409).json({ error: "request_in_progress", requestId });
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
      recordEvent("billing.charge_created", { chargeId: charge.id, tenantId, idempotent: true });
      res.status(201).json(body);
    } catch (error) {
      idempotencyStore.release(claim.record);
      throw error;
    }
  });

  router.get("/api/v1/charges", (req: Request, res: Response) => {
    const tenantId = resolveTenantId(req);
    res.status(200).json({ charges: chargeStore.list(tenantId), requestId: getRequestId(req) });
  });

  return router;
}

