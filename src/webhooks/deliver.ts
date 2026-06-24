import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { lookup } from "node:dns/promises";
import net from "node:net";
import type { AppEvent } from "../events.js";
import { webhookStore, type WebhookRecord } from "../store/state.js";

export type DeliveryResult = {
  delivered: boolean;
  attempts: number;
  status?: number;
  error?: string;
};

const MAX_ATTEMPTS = 3;
const DELIVERY_TIMEOUT_MS = 3_000;

/**
 * Signs the exact JSON payload that is sent to a webhook subscriber.
 */
export function signWebhookPayload(secret: string, body: string) {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

/**
 * Verifies a signed webhook payload using constant-time comparison.
 */
export function verifyWebhookSignature(
  secret: string,
  body: string,
  signature: string
) {
  const expected = signWebhookPayload(secret, body);
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(signature);
  return (
    expectedBuffer.length === receivedBuffer.length &&
    timingSafeEqual(expectedBuffer, receivedBuffer)
  );
}

export function createWebhookSecret() {
  return `whsec_${randomUUID().replace(/-/g, "")}`;
}

function isPrivateIp(address: string) {
  if (net.isIPv4(address)) {
    const [a, b] = address.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    );
  }
  if (net.isIPv6(address)) {
    const lower = address.toLowerCase();
    return (
      lower === "::1" ||
      lower.startsWith("fc") ||
      lower.startsWith("fd") ||
      lower.startsWith("fe80:")
    );
  }
  return true;
}

async function assertWebhookTargetAllowed(url: string) {
  if (process.env.ALLOW_PRIVATE_WEBHOOKS === "true") return;
  const parsed = new URL(url);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("webhook URL must use http or https");
  }
  if (parsed.hostname === "localhost") {
    throw new Error("private webhook targets are disabled");
  }
  const addresses = net.isIP(parsed.hostname)
    ? [{ address: parsed.hostname }]
    : await lookup(parsed.hostname, { all: true });
  if (addresses.some((entry) => isPrivateIp(entry.address))) {
    throw new Error("private webhook targets are disabled");
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postWebhook(url: string, body: string, secret: string, event: AppEvent) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);
  try {
    return await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-AgentPay-Delivery": randomUUID(),
        "X-AgentPay-Event": event.type,
        "X-AgentPay-Signature": signWebhookPayload(secret, body),
      },
      body,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function markDeadLetter(id: string, hook: WebhookRecord) {
  webhookStore.set(id, { ...hook, deadLetters: hook.deadLetters + 1 });
}

/**
 * Delivers one event to one webhook with SSRF checks, HMAC signing, and retries.
 */
export async function deliverSingleWebhook(
  id: string,
  hook: WebhookRecord,
  event: AppEvent
): Promise<DeliveryResult> {
  const body = JSON.stringify({
    id: event.id,
    type: event.type,
    ts: event.ts,
    payload: event.payload,
  });

  try {
    await assertWebhookTargetAllowed(hook.url);
  } catch (err) {
    markDeadLetter(id, hook);
    return {
      delivered: false,
      attempts: 0,
      error: err instanceof Error ? err.message : "webhook target rejected",
    };
  }

  let lastStatus: number | undefined;
  let lastError: string | undefined;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await postWebhook(hook.url, body, hook.secret, event);
      lastStatus = response.status;
      if (response.ok) {
        return { delivered: true, attempts: attempt, status: response.status };
      }
      if (response.status >= 400 && response.status < 500) {
        markDeadLetter(id, hook);
        return { delivered: false, attempts: attempt, status: response.status };
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : "webhook delivery failed";
    }
    if (attempt < MAX_ATTEMPTS) await sleep(10 * 2 ** (attempt - 1));
  }

  markDeadLetter(id, hook);
  return {
    delivered: false,
    attempts: MAX_ATTEMPTS,
    status: lastStatus,
    error: lastError,
  };
}

/**
 * Fan out an event to every webhook subscribed to the event type or `*`.
 */
export async function deliverWebhookEvent(event: AppEvent) {
  const tasks: Promise<DeliveryResult>[] = [];
  for (const [id, hook] of webhookStore.entries()) {
    if (hook.events.includes("*") || hook.events.includes(event.type)) {
      tasks.push(deliverSingleWebhook(id, hook, event));
    }
  }
  return Promise.allSettled(tasks);
}
