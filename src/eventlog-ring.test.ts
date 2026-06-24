import { describe, it } from "node:test";
import assert from "node:assert";
import { type AppEvent, listEvents, RingEventLog, summarizeEvents } from "./events.js";

function makeEvent(index: number, type = "usage.recorded"): AppEvent {
  return {
    id: `evt-${index}`,
    ts: index,
    type,
    payload: { index },
  };
}

void describe("RingEventLog", () => {
  void it("keeps chronological order below capacity", () => {
    const log = new RingEventLog(3);
    log.push(makeEvent(1));
    log.push(makeEvent(2));

    assert.strictEqual(log.length, 2);
    assert.deepStrictEqual(
      log.toArray().map((event) => event.payload.index),
      [1, 2]
    );
  });

  void it("keeps all entries exactly at capacity", () => {
    const log = new RingEventLog(3);
    log.push(makeEvent(1));
    log.push(makeEvent(2));
    log.push(makeEvent(3));

    assert.strictEqual(log.length, 3);
    assert.deepStrictEqual(
      log.toArray().map((event) => event.payload.index),
      [1, 2, 3]
    );
  });

  void it("evicts oldest entries in O(1) while preserving chronological reads", () => {
    const log = new RingEventLog(3);
    for (let i = 1; i <= 5; i++) log.push(makeEvent(i));

    assert.strictEqual(log.length, 3);
    assert.strictEqual(log.at(0)?.payload.index, 3);
    assert.strictEqual(log.at(-1)?.payload.index, 5);
    assert.deepStrictEqual(
      log.toArray().map((event) => event.payload.index),
      [3, 4, 5]
    );
  });

  void it("summarizes retained events after wraparound", () => {
    const log = new RingEventLog(3);
    log.push(makeEvent(1, "usage.recorded"));
    log.push(makeEvent(2, "usage.settled"));
    log.push(makeEvent(3, "usage.recorded"));
    log.push(makeEvent(4, "webhook.test"));

    assert.deepStrictEqual(summarizeEvents(log), {
      counts: {
        "usage.recorded": 1,
        "usage.settled": 1,
        "webhook.test": 1,
      },
      total: 3,
    });
  });

  void it("preserves since/type/limit query semantics after wraparound", () => {
    const log = new RingEventLog(4);
    log.push(makeEvent(1, "usage.recorded"));
    log.push(makeEvent(2, "usage.settled"));
    log.push(makeEvent(3, "usage.recorded"));
    log.push(makeEvent(4, "usage.settled"));
    log.push(makeEvent(5, "usage.recorded"));

    const items = listEvents({ since: 3, type: "usage.recorded", limit: 1 }, log);

    assert.deepStrictEqual(
      items.map((event) => event.payload.index),
      [5]
    );
  });
});
