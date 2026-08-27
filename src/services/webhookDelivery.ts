import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import {
  type DeadLetterRecord,
  type WebhookRecord,
  webhookDeadLetterStore,
  webhookDeliveredStore,
  webhookSecretStore,
  webhookStore,
} from "../store/state.js";

export const DEFAULT_MAX_ATTEMPTS = 4;
export const DEFAULT_BACKOFF_BASE_MS = 250;
export const DEFAULT_BACKOFF_MAX_MS = 10_000;
export const MAX_WEBHOOK_BODY_BYTES = 256 * 1024;
export const SIGNATURE_HEADER = "X-Signature";
export const TIMESTAMP_HEADER = "X-Signature-Timestamp";
export const DELIVERY_HEADER = "X-Delivery-Id";

export type DeliveryResponse = { status: number };
export type DeliveryTransport = (
  url: string,
  init: { method: "POST"; headers: Record<string, string>; body: string }
) => Promise<DeliveryResponse>;

export type DeliveryOptions = {
  transport?: DeliveryTransport;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  random?: () => number;
  maxAttempts?: number;
  backoffBaseMs?: number;
  backoffMaxMs?: number;
  secret: string;
};

export type DeliveryInput = {
  deliveryId?: string;
  webhookId: string;
  eventType: string;
  payload: Record<string, unknown>;
};

export type DeliveryResult = {
  deliveryId: string;
  delivered: boolean;
  attempts: number;
  deadLettered: boolean;
  lastError?: string;
};

export type WebhookDeliveryErrorCode =
  | "INVALID_SECRET"
  | "PAYLOAD_TOO_LARGE"
  | "DEAD_LETTER_NOT_FOUND";

/** Public error shape for callers; internal transport details stay in DLQ records. */
export class WebhookDeliveryError extends Error {
  readonly code: WebhookDeliveryErrorCode;

  constructor(code: WebhookDeliveryErrorCode, message: string) {
    super(message);
    this.name = "WebhookDeliveryError";
    this.code = code;
  }
}

const defaultTransport: DeliveryTransport = async (url, init) => {
  const response = await fetch(url, init);
  return { status: response.status };
};

function boundedAttempts(value: number | undefined): number {
  if (!Number.isInteger(value) || value === undefined || value < 1) {
    return DEFAULT_MAX_ATTEMPTS;
  }
  return Math.min(value, 10);
}

function boundedBackoff(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value) || value === undefined || value < 0) return fallback;
  return Math.min(Math.floor(value), DEFAULT_BACKOFF_MAX_MS);
}

function bodyFor(input: DeliveryInput, timestamp: number): string {
  return JSON.stringify({
    deliveryId: input.deliveryId,
    eventType: input.eventType,
    payload: input.payload,
    timestamp,
  });
}

export function signWebhookBody(body: string, secret: string, timestamp: number): string {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

export function buildSignedWebhookRequest(
  input: DeliveryInput,
  secret: string,
  timestamp: number,
): { body: string; headers: Record<string, string> } {
  if (secret.length === 0) {
    throw new WebhookDeliveryError("INVALID_SECRET", "webhook signing secret is required");
  }
  const body = bodyFor(input, timestamp);
  if (Buffer.byteLength(body, "utf8") > MAX_WEBHOOK_BODY_BYTES) {
    throw new WebhookDeliveryError(
      "PAYLOAD_TOO_LARGE",
      "webhook payload exceeds maximum size",
    );
  }
  return {
    body,
    headers: {
      "Content-Type": "application/json",
      [SIGNATURE_HEADER]: signWebhookBody(body, secret, timestamp),
      [TIMESTAMP_HEADER]: String(timestamp),
      [DELIVERY_HEADER]: input.deliveryId ?? "",
    },
  };
}

export function verifyWebhookSignature(
  body: string,
  secret: string,
  timestamp: number,
  signature: string,
): boolean {
  const expected = signWebhookBody(body, secret, timestamp);
  const actual = Buffer.from(signature, "hex");
  const wanted = Buffer.from(expected, "hex");
  return actual.length === wanted.length && timingSafeEqual(actual, wanted);
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function retryDelay(
  attempt: number,
  base: number,
  maximum: number,
  random: () => number,
): number {
  const exponential = Math.min(maximum, base * 2 ** Math.max(0, attempt - 1));
  const jitter = Math.min(1, Math.max(0, random())) * Math.min(base, exponential);
  return Math.min(maximum, Math.floor(exponential + jitter));
}

function deadLetter(
  input: DeliveryInput,
  attempts: number,
  error: string,
  now: number,
): void {
  const deliveryId = input.deliveryId ?? "";
  const existing = webhookDeadLetterStore.get(deliveryId);
  const record: DeadLetterRecord = {
    deliveryId,
    webhookId: input.webhookId,
    eventType: input.eventType,
    payload: structuredClone(input.payload),
    lastError: error,
    attempts,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  webhookDeadLetterStore.set(deliveryId, record);
}

export async function deliverWebhook(
  webhook: WebhookRecord,
  input: DeliveryInput,
  options: DeliveryOptions,
): Promise<DeliveryResult> {
  const deliveryId = input.deliveryId ?? randomUUID();
  const requestInput = { ...input, deliveryId };
  if (webhookDeliveredStore.has(deliveryId)) {
    return { deliveryId, delivered: true, attempts: 0, deadLettered: false };
  }
  const transport = options.transport ?? defaultTransport;
  const sleep = options.sleep ?? ((ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const now = options.now ?? Date.now;
  const random = options.random ?? Math.random;
  const maxAttempts = boundedAttempts(options.maxAttempts);
  const base = boundedBackoff(options.backoffBaseMs, DEFAULT_BACKOFF_BASE_MS);
  const maximum = boundedBackoff(options.backoffMaxMs, DEFAULT_BACKOFF_MAX_MS);
  let lastError = "delivery failed";
  let attempts = 0;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    attempts = attempt;
    const timestamp = now();
    try {
      const request = buildSignedWebhookRequest(requestInput, options.secret, timestamp);
      const result = await transport(webhook.url, {
        method: "POST",
        headers: request.headers,
        body: request.body,
      });
      if (result.status >= 200 && result.status < 300) {
        webhookDeliveredStore.add(deliveryId);
        webhookDeadLetterStore.delete(deliveryId);
        return { deliveryId, delivered: true, attempts, deadLettered: false };
      }
      lastError = `upstream returned HTTP ${result.status}`;
      if (!isRetryableStatus(result.status)) break;
    } catch (error) {
      lastError = error instanceof Error ? error.message : "transport failure";
    }
    if (attempt < maxAttempts) {
      await sleep(retryDelay(attempt, base, maximum, random));
    }
  }

  deadLetter(requestInput, attempts, lastError, now());
  return {
    deliveryId,
    delivered: false,
    attempts,
    deadLettered: true,
    lastError,
  };
}

export type EventDeliveryOptions = Omit<DeliveryOptions, "secret"> & {
  secretForWebhook?: (webhookId: string) => string | undefined;
};

/**
 * Delivers one application event to every matching registered subscriber.
 * A wildcard subscription receives all event types. Each delivery retains its
 * own idempotency key and DLQ record, so one failed subscriber cannot block
 * another subscriber or cause a duplicate on retry.
 */
export async function deliverEventToWebhooks(
  eventType: string,
  payload: Record<string, unknown>,
  options: EventDeliveryOptions,
): Promise<DeliveryResult[]> {
  const secretForWebhook = options.secretForWebhook ?? ((webhookId) =>
    webhookSecretStore.get(webhookId)?.secret);
  const deliveries: Promise<DeliveryResult>[] = [];
  for (const [webhookId, webhook] of webhookStore) {
    if (!webhook.events.includes("*") && !webhook.events.includes(eventType)) continue;
    const secret = secretForWebhook(webhookId) ?? "";
    deliveries.push(
      deliverWebhook(
        webhook,
        { webhookId, eventType, payload },
        { ...options, secret },
      ),
    );
  }
  return Promise.all(deliveries);
}

export function listDeadLetters(): DeadLetterRecord[] {
  return [...webhookDeadLetterStore.values()].sort(
    (left, right) => left.createdAt - right.createdAt || left.deliveryId.localeCompare(right.deliveryId),
  );
}

export function getDeadLetter(deliveryId: string): DeadLetterRecord | undefined {
  return webhookDeadLetterStore.get(deliveryId);
}

export async function replayDeadLetter(
  deliveryId: string,
  webhook: WebhookRecord,
  options: DeliveryOptions,
): Promise<DeliveryResult> {
  const record = webhookDeadLetterStore.get(deliveryId);
  if (!record) {
    return {
      deliveryId,
      delivered: false,
      attempts: 0,
      deadLettered: false,
      lastError: "dead-letter delivery not found",
    };
  }
  return deliverWebhook(
    webhook,
    {
      deliveryId: record.deliveryId,
      webhookId: record.webhookId,
      eventType: record.eventType,
      payload: record.payload,
    },
    options,
  );
}
