import { randomUUID } from "node:crypto";
import { deliverWebhookEvent } from "./webhooks/deliver.js";

export type AppEvent = {
  id: string;
  ts: number;
  type: string;
  payload: Record<string, unknown>;
};

export const EVENT_LOG_CAP = 10_000;
export const eventLog: AppEvent[] = [];

/**
 * Appends an audit event to the bounded in-memory event log.
 */
export function recordEvent(type: string, payload: Record<string, unknown>): void {
  const event = { id: randomUUID(), ts: Date.now(), type, payload };
  eventLog.push(event);
  if (eventLog.length > EVENT_LOG_CAP) eventLog.shift();
  void deliverWebhookEvent(event);
}
