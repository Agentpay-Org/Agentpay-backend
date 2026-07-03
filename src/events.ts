import { randomUUID } from "node:crypto";

export type AppEvent = {
  id: string;
  ts: number;
  type: string;
  payload: Record<string, unknown>;
};

export const EVENT_LOG_CAP = 10_000;
export const eventLog: AppEvent[] = [];

export const KNOWN_EVENT_TYPES = [
  "usage.recorded",
  "usage.settled",
  "webhook.test",
] as const;

/**
 * Appends an audit event to the bounded in-memory event log.
 */
export function recordEvent(type: string, payload: Record<string, unknown>): void {
  eventLog.push({ id: randomUUID(), ts: Date.now(), type, payload });
  if (eventLog.length > EVENT_LOG_CAP) eventLog.shift();
}
