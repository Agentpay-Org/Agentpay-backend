import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { InMemoryStore, JsonFileStore, StoreMap, StoreSet } from "./index.js";

let tempRoot = "";

const relativeTempDir = () => path.relative(process.cwd(), tempRoot);

beforeEach(() => {
  tempRoot = mkdtempSync(path.join(process.cwd(), ".agentpay-store-test-"));
});

afterEach(() => {
  if (tempRoot) rmSync(tempRoot, { recursive: true, force: true });
  tempRoot = "";
});

void describe("store adapters", () => {
  void it("supports in-memory get, set, delete, entries, and prefix scans", () => {
    const store = new InMemoryStore<number>();

    store.set("agent-a::svc-1", 3);
    store.set("agent-a::svc-2", 4);
    store.set("agent-b::svc-1", 5);

    assert.strictEqual(store.get("agent-a::svc-1"), 3);
    assert.deepStrictEqual(Array.from(store.scanByPrefix("agent-a::")), [
      ["agent-a::svc-1", 3],
      ["agent-a::svc-2", 4],
    ]);
    assert.strictEqual(store.delete("agent-b::svc-1"), true);
    assert.deepStrictEqual(Array.from(store.entries()), [
      ["agent-a::svc-1", 3],
      ["agent-a::svc-2", 4],
    ]);
  });

  void it("round-trips JSON file state across store instances", () => {
    const first = new JsonFileStore<number>("usage", relativeTempDir());
    first.set("agent-a::svc-1", 7);
    first.set("agent-b::svc-2", 9);
    first.flush();

    const second = new JsonFileStore<number>("usage", relativeTempDir());
    assert.strictEqual(second.get("agent-a::svc-1"), 7);
    assert.deepStrictEqual(Array.from(second.scanByPrefix("agent-b::")), [
      ["agent-b::svc-2", 9],
    ]);
  });

  void it("starts empty when the JSON file is missing", () => {
    const store = new JsonFileStore<number>("missing", relativeTempDir());
    assert.deepStrictEqual(Array.from(store.entries()), []);
  });

  void it("fails closed on corrupt JSON files", () => {
    writeFileSync(path.join(tempRoot, "corrupt.json"), "{not-json", "utf8");

    assert.throws(
      () => new JsonFileStore<number>("corrupt", relativeTempDir()),
      SyntaxError
    );
  });

  void it("rejects storage paths outside the project directory", () => {
    assert.throws(
      () => new JsonFileStore<number>("usage", os.tmpdir()),
      /STORAGE_PATH/
    );
  });

  void it("keeps StoreMap writes, deletes, and clears durable", () => {
    const map = new StoreMap(
      new JsonFileStore<{ priceStroops: number }>("services", relativeTempDir())
    );

    map.set("svc-a", { priceStroops: 12 });
    assert.strictEqual(map.get("svc-a")?.priceStroops, 12);
    map.delete("svc-a");
    map.set("svc-b", { priceStroops: 20 });

    let reloaded = new StoreMap(
      new JsonFileStore<{ priceStroops: number }>("services", relativeTempDir())
    );
    assert.strictEqual(reloaded.has("svc-a"), false);
    assert.strictEqual(reloaded.get("svc-b")?.priceStroops, 20);

    reloaded.clear();
    reloaded = new StoreMap(
      new JsonFileStore<{ priceStroops: number }>("services", relativeTempDir())
    );
    assert.strictEqual(reloaded.size, 0);
  });

  void it("keeps StoreSet writes and deletes durable", () => {
    const set = new StoreSet(
      new JsonFileStore<boolean>("services-disabled", relativeTempDir())
    );

    set.add("svc-a");
    set.add("svc-b");
    set.delete("svc-a");

    const reloaded = new StoreSet(
      new JsonFileStore<boolean>("services-disabled", relativeTempDir())
    );
    assert.deepStrictEqual(Array.from(reloaded), ["svc-b"]);
  });
});
