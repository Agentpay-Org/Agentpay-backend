import { describe, it } from "node:test";
import assert from "node:assert";
import {
  DEFAULT_SERVICE_RETRY_POLICY,
  INITIAL_SERVICE_VERSION,
  InvalidServiceVersionError,
  ServiceVersionConflictError,
  canUpdateService,
  conflictResponse,
  nextServiceVersion,
  parseServiceVersion,
  requireServiceVersion,
  serviceRetryDelay,
  serviceRetryInstruction,
  versionForService,
} from "./serviceVersioning.js";

void describe("service optimistic-concurrency policy", () => {
  void it("starts at version one", () => {
    assert.strictEqual(INITIAL_SERVICE_VERSION, 1);
    assert.strictEqual(versionForService(false, new Map(), "svc"), 1);
  });

  void it("heals a legacy service without a version entry", () => {
    const versions = new Map<string, number>();
    assert.strictEqual(versionForService(true, versions, "svc"), 1);
    assert.deepStrictEqual(versions, new Map([["svc", 1]]));
  });

  void it("returns an existing version without resetting it", () => {
    const versions = new Map([["svc", 7]]);
    assert.strictEqual(versionForService(true, versions, "svc"), 7);
    assert.strictEqual(versions.get("svc"), 7);
  });

  void it("parses only safe JSON integers", () => {
    assert.strictEqual(parseServiceVersion(1), 1);
    assert.strictEqual(parseServiceVersion(42), 42);
    assert.strictEqual(parseServiceVersion("42"), undefined);
    assert.strictEqual(parseServiceVersion(1.5), undefined);
    assert.strictEqual(parseServiceVersion(0), undefined);
    assert.strictEqual(parseServiceVersion(-1), undefined);
    assert.strictEqual(parseServiceVersion(Number.MAX_SAFE_INTEGER + 1), undefined);
    assert.strictEqual(parseServiceVersion(undefined), undefined);
  });

  void it("rejects malformed required versions with a typed 400 error", () => {
    for (const value of [undefined, null, "", "1", 0, -4, 1.1, Number.NaN]) {
      assert.throws(() => requireServiceVersion(value), (error: unknown) => {
        return error instanceof InvalidServiceVersionError && error.statusCode === 400;
      });
    }
  });

  void it("accepts a matching compare-and-set version", () => {
    assert.deepStrictEqual(canUpdateService(3, 3), { ok: true, version: 3 });
  });

  void it("rejects a stale compare-and-set version", () => {
    const result = canUpdateService(4, 3);
    assert.strictEqual(result.ok, false);
    if (!result.ok) {
      assert.ok(result.error instanceof ServiceVersionConflictError);
      assert.strictEqual(result.error.expectedVersion, 3);
      assert.strictEqual(result.error.currentVersion, 4);
      assert.strictEqual(result.error.retryable, true);
    }
  });

  void it("serializes only safe conflict fields", () => {
    const error = new ServiceVersionConflictError(2, 5);
    assert.deepStrictEqual(conflictResponse(error, "request-1"), {
      error: "version_conflict",
      expectedVersion: 2,
      currentVersion: 5,
      retryable: true,
      message: "service was modified; re-read and retry with the current version",
      requestId: "request-1",
    });
  });

  void it("advances a version exactly once", () => {
    const versions = new Map([["svc", 1]]);
    assert.strictEqual(nextServiceVersion(versions, "svc", 1), 2);
    assert.strictEqual(versions.get("svc"), 2);
    assert.strictEqual(nextServiceVersion(versions, "svc", 2), 3);
    assert.strictEqual(versions.get("svc"), 3);
  });

  void it("does not advance when a conflict is detected", () => {
    const versions = new Map([["svc", 9]]);
    const result = canUpdateService(9, 8);
    assert.strictEqual(result.ok, false);
    assert.strictEqual(versions.get("svc"), 9);
  });

  void it("uses bounded exponential retry delays", () => {
    assert.deepStrictEqual(DEFAULT_SERVICE_RETRY_POLICY, {
      maxAttempts: 3,
      baseDelayMs: 25,
      maxDelayMs: 1_000,
    });
    assert.strictEqual(serviceRetryDelay(1), 25);
    assert.strictEqual(serviceRetryDelay(2), 50);
    assert.strictEqual(serviceRetryDelay(3), 0);
    assert.strictEqual(serviceRetryDelay(2, { baseDelayMs: 700, maxDelayMs: 800 }), 800);
  });

  void it("rejects invalid retry attempts", () => {
    assert.throws(() => serviceRetryDelay(0), RangeError);
    assert.throws(() => serviceRetryDelay(1.2), RangeError);
    assert.throws(() => serviceRetryDelay(-1), RangeError);
  });

  void it("gives clients a fresh-version retry instruction", () => {
    assert.strictEqual(
      serviceRetryInstruction(12),
      "Re-read the service and retry with expectedVersion 12."
    );
  });
});
