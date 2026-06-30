import { randomUUID } from "node:crypto";
import { config } from "./store/state.js";

export type AppEvent = {
  id: string;
  ts: number;
  type: string;
  payload: Record<string, unknown>;
};

export const DEFAULT_EVENT_LOG_CAP = 10_000;
export const eventLog: AppEvent[] = [];

export function getEventLogCap(): number {
  return config.eventLogCap ?? DEFAULT_EVENT_LOG_CAP;
}

export function trimEventLogToCap(cap = getEventLogCap()): void {
  while (eventLog.length > cap) eventLog.shift();
}

/**
 * Appends an audit event to the bounded in-memory event log.
 */
export function recordEvent(type: string, payload: Record<string, unknown>): void {
  eventLog.push({ id: randomUUID(), ts: Date.now(), type, payload });
  trimEventLogToCap();
}
