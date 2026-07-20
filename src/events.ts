import { randomUUID } from "node:crypto";
import { config } from "./store/state.js";

export type AppEvent = {
  id: string;
  ts: number;
  type: string;
  payload: Record<string, unknown>;
};

export const DEFAULT_EVENT_LOG_CAP = 10_000;
export const EVENT_LOG_CAP = DEFAULT_EVENT_LOG_CAP;
export const eventLog: AppEvent[] = [];

export const KNOWN_EVENT_TYPES = [
  "usage.recorded",
  "usage.settled",
  "webhook.test",
] as const;

export function trimEventLogToCap(): void {
  while (eventLog.length > config.eventLogCap) {
    eventLog.shift();
  }
}

/**
 * Appends an audit event to the bounded in-memory event log.
 */
export function recordEvent(
  type: string,
  payload: Record<string, unknown>
): AppEvent {
  const event: AppEvent = {
    id: randomUUID(),
    ts: Date.now(),
    type,
    payload,
  };
  eventLog.push(event);
  trimEventLogToCap();
  return event;
}
