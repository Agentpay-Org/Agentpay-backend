import { describe, it } from "node:test";
import assert from "node:assert";
import type { EventEmitter } from "node:events";
import {
  createShutdownController,
  installProcessFaultHandlers,
  isServerEntrypoint,
} from "./index.js";

function createFakeLogger() {
  const logs: string[] = [];
  const errors: string[] = [];
  return {
    logs,
    errors,
    logger: {
      log: (...parts: unknown[]) => logs.push(parts.map(String).join(" ")),
      error: (...parts: unknown[]) => errors.push(parts.map(String).join(" ")),
    },
  };
}

void describe("process fault handlers", () => {
  void it("does not treat test modules as the server entrypoint", () => {
    assert.strictEqual(
      isServerEntrypoint(["node", "dist/process-handlers.test.js"]),
      false
    );
    assert.strictEqual(isServerEntrypoint(["node", "dist/index.js"]), true);
    assert.strictEqual(isServerEntrypoint(["node", "src/index.ts"]), true);
  });

  void it("installs unhandled rejection and uncaught exception handlers", () => {
    const listeners = new Map<string, (...args: unknown[]) => void>();
    const processLike: Pick<EventEmitter, "on"> = {
      on(eventName, listener) {
        listeners.set(String(eventName), listener as (...args: unknown[]) => void);
        return processLike as EventEmitter;
      },
    };
    const handled: string[] = [];
    const controller = {
      handleProcessFault(event: string, reason: unknown) {
        handled.push(`${event}:${String(reason)}`);
        return true;
      },
    };

    installProcessFaultHandlers(processLike, controller);
    listeners.get("unhandledRejection")?.("rejected");
    listeners.get("uncaughtException")?.(new Error("thrown"));

    assert.deepStrictEqual(handled, [
      "unhandledRejection:rejected",
      "uncaughtException:Error: thrown",
    ]);
  });

  void it("drains once with a non-zero exit code after an unhandled rejection", () => {
    let closeCalls = 0;
    let closeCallback: ((err?: Error) => void) | undefined;
    let timeoutCallback: (() => void) | undefined;
    const exitCodes: number[] = [];
    const { logger, logs, errors } = createFakeLogger();
    const server = {
      close(callback: (err?: Error) => void) {
        closeCalls += 1;
        closeCallback = callback;
        return server;
      },
    };
    const controller = createShutdownController({
      server,
      logger,
      exit: (code = 0) => {
        exitCodes.push(code);
      },
      setTimeoutFn: (callback: () => void) => {
        timeoutCallback = callback;
        return {
          unref() {
            return undefined;
          },
        };
      },
    });

    assert.strictEqual(
      controller.handleProcessFault("unhandledRejection", new Error("boom")),
      true
    );
    assert.strictEqual(
      controller.handleProcessFault("uncaughtException", new Error("again")),
      false
    );
    closeCallback?.();

    assert.strictEqual(closeCalls, 1);
    assert.deepStrictEqual(exitCodes, [1]);
    assert.ok(logs.some((line) => line.includes("unhandledRejection")));
    assert.ok(
      errors.some(
        (line) =>
          line.includes("process_fault") &&
          line.includes("unhandledRejection") &&
          line.includes("boom")
      )
    );
    assert.ok(timeoutCallback);
  });

  void it("forces a non-zero exit when the drain timeout fires", () => {
    let timeoutCallback: (() => void) | undefined;
    const exitCodes: number[] = [];
    const { logger } = createFakeLogger();
    const server = {
      close(_callback: (err?: Error) => void) {
        return server;
      },
    };
    const controller = createShutdownController({
      server,
      logger,
      exit: (code = 0) => {
        exitCodes.push(code);
      },
      setTimeoutFn: (callback: () => void) => {
        timeoutCallback = callback;
        return {
          unref() {
            return undefined;
          },
        };
      },
    });

    assert.strictEqual(controller.shutdown("SIGTERM"), true);
    timeoutCallback?.();

    assert.deepStrictEqual(exitCodes, [1]);
  });

  void it("upgrades an in-progress signal drain to a non-zero process-fault exit", () => {
    let closeCalls = 0;
    let closeCallback: ((err?: Error) => void) | undefined;
    const exitCodes: number[] = [];
    const { logger } = createFakeLogger();
    const server = {
      close(callback: (err?: Error) => void) {
        closeCalls += 1;
        closeCallback = callback;
        return server;
      },
    };
    const controller = createShutdownController({
      server,
      logger,
      exit: (code = 0) => {
        exitCodes.push(code);
      },
      setTimeoutFn: () => ({
        unref() {
          return undefined;
        },
      }),
    });

    assert.strictEqual(controller.shutdown("SIGTERM"), true);
    assert.strictEqual(
      controller.handleProcessFault("uncaughtException", new Error("late fault")),
      false
    );
    closeCallback?.();

    assert.strictEqual(closeCalls, 1);
    assert.deepStrictEqual(exitCodes, [1]);
  });
});
