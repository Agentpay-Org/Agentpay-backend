import { randomUUID } from "node:crypto";

export type AppEvent = {
  id: string;
  ts: number;
  type: string;
  payload: Record<string, unknown>;
};

export const EVENT_LOG_CAP = 10_000;

/** Fixed-capacity chronological event log with O(1) insertion and eviction. */
export class RingEventLog {
  readonly capacity: number;
  #items: AppEvent[];
  #start = 0;
  #size = 0;

  constructor(capacity: number) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new RangeError("event log capacity must be a positive integer");
    }
    this.capacity = capacity;
    this.#items = new Array<AppEvent>(capacity);
  }

  get length(): number {
    return this.#size;
  }

  clear(): void {
    this.#items = new Array<AppEvent>(this.capacity);
    this.#start = 0;
    this.#size = 0;
  }

  push(event: AppEvent): void {
    if (this.#size < this.capacity) {
      this.#items[(this.#start + this.#size) % this.capacity] = event;
      this.#size++;
      return;
    }

    this.#items[this.#start] = event;
    this.#start = (this.#start + 1) % this.capacity;
  }

  at(index: number): AppEvent | undefined {
    const normalized = index < 0 ? this.#size + index : index;
    if (normalized < 0 || normalized >= this.#size) return undefined;
    return this.#items[(this.#start + normalized) % this.capacity];
  }

  toArray(): AppEvent[] {
    const items: AppEvent[] = [];
    for (let i = 0; i < this.#size; i++) {
      const item = this.at(i);
      if (item !== undefined) items.push(item);
    }
    return items;
  }

  [Symbol.iterator](): IterableIterator<AppEvent> {
    return this.toArray()[Symbol.iterator]();
  }
}

export const eventLog = new RingEventLog(EVENT_LOG_CAP);

/**
 * Appends an audit event to the bounded in-memory event log.
 *
 * The ring buffer capacity follows EVENT_LOG_CAP. Runtime config currently
 * exposes eventLogCap for readback only; /api/v1/config does not allow changing
 * it, so preserving the constant avoids a hidden mutable cap.
 */
export function recordEvent(type: string, payload: Record<string, unknown>): void {
  eventLog.push({ id: randomUUID(), ts: Date.now(), type, payload });
}

export function clearEventLog(): void {
  eventLog.clear();
}

export function listEvents(
  {
    limit,
    since,
    type,
  }: {
    limit: number;
    since: number;
    type?: string;
  },
  log: RingEventLog = eventLog
): AppEvent[] {
  return log
    .toArray()
    .filter((event) => event.ts >= since && (type === undefined || event.type === type))
    .slice(-limit);
}

export function summarizeEvents(log: RingEventLog = eventLog): {
  counts: Record<string, number>;
  total: number;
} {
  const counts: Record<string, number> = {};
  for (const event of log) counts[event.type] = (counts[event.type] ?? 0) + 1;
  return { counts, total: log.length };
}
