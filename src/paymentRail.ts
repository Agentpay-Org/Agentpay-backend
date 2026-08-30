/**
 * Resilience primitives for calls to external payment-rail dependencies.
 *
 * The module deliberately owns policy, not transport. Callers provide one
 * operation function, which keeps HTTP/SDK details out of retry and breaker
 * decisions and makes the policy safe to exercise in deterministic tests.
 */

export type CircuitState = "closed" | "open" | "half_open";

export type RetryConfig = {
  /** Total attempts, including the first call. */
  maxAttempts: number;
  /** Base delay before the second attempt. */
  baseDelayMs: number;
  /** Upper bound for an individual backoff delay. */
  maxDelayMs: number;
  /** Random delay spread as a fraction of the calculated delay. */
  jitterRatio: number;
};

export type CircuitBreakerConfig = {
  /** Consecutive failed calls needed to open the circuit. */
  failureThreshold: number;
  /** Time an open circuit must remain open before a probe is allowed. */
  cooldownMs: number;
};

export type PaymentRailConfig = RetryConfig & CircuitBreakerConfig;

export const DEFAULT_PAYMENT_RAIL_CONFIG: PaymentRailConfig = {
  maxAttempts: 3,
  baseDelayMs: 100,
  maxDelayMs: 2_000,
  jitterRatio: 0.2,
  failureThreshold: 3,
  cooldownMs: 10_000,
};

export type PaymentRailErrorCode =
  | "upstream_unavailable"
  | "upstream_rejected"
  | "circuit_open"
  | "invalid_configuration";

/** Stable error shape for API handlers and queue consumers. */
export class PaymentRailError extends Error {
  readonly code: PaymentRailErrorCode;
  readonly dependency: string;
  readonly attempts: number;
  readonly retryable: boolean;
  readonly cause: unknown;

  constructor(
    code: PaymentRailErrorCode,
    dependency: string,
    message: string,
    options: {
      attempts?: number;
      retryable?: boolean;
      cause?: unknown;
    } = {}
  ) {
    super(message);
    this.name = "PaymentRailError";
    this.code = code;
    this.dependency = dependency;
    this.attempts = options.attempts ?? 0;
    this.retryable = options.retryable ?? false;
    this.cause = options.cause;
  }
}

export type PaymentRailMetric = {
  dependency: string;
  event:
    | "attempt"
    | "retry_scheduled"
    | "success"
    | "failure"
    | "circuit_opened"
    | "circuit_probe"
    | "circuit_rejected";
  attempt?: number;
  delayMs?: number;
  state: CircuitState;
  errorCode?: PaymentRailErrorCode;
};

export type PaymentRailLogger = (
  fields: {
    dependency: string;
    attempt?: number;
    delayMs?: number;
    state: CircuitState;
    error?: unknown;
  },
  message: string
) => void;

export type PaymentRailHooks = {
  onMetric?: (metric: PaymentRailMetric) => void;
  logger?: PaymentRailLogger;
};

export type PaymentRailExecutionOptions = PaymentRailHooks & {
  /** The dependency name is also the circuit-breaker isolation key. */
  dependency: string;
  /** Retries are permitted only when the operation is safe to repeat. */
  idempotent: boolean;
  config?: Partial<PaymentRailConfig>;
  /** Injectable clock, delay, and random source keep policy testable. */
  now?: () => number;
  sleep?: (delayMs: number) => Promise<void>;
  random?: () => number;
  isRetryable?: (error: unknown) => boolean;
};

type ResolvedConfig = PaymentRailConfig;

function positiveInteger(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new PaymentRailError(
      "invalid_configuration",
      "payment-rail",
      `${field} must be a positive integer`
    );
  }
  return value;
}

function nonNegativeNumber(value: number, field: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new PaymentRailError(
      "invalid_configuration",
      "payment-rail",
      `${field} must be a non-negative finite number`
    );
  }
  return value;
}

function resolveConfig(overrides: Partial<PaymentRailConfig> = {}): ResolvedConfig {
  const config = { ...DEFAULT_PAYMENT_RAIL_CONFIG, ...overrides };
  positiveInteger(config.maxAttempts, "maxAttempts");
  positiveInteger(config.failureThreshold, "failureThreshold");
  nonNegativeNumber(config.baseDelayMs, "baseDelayMs");
  nonNegativeNumber(config.maxDelayMs, "maxDelayMs");
  nonNegativeNumber(config.cooldownMs, "cooldownMs");
  if (
    !Number.isFinite(config.jitterRatio) ||
    config.jitterRatio < 0 ||
    config.jitterRatio > 1
  ) {
    throw new PaymentRailError(
      "invalid_configuration",
      "payment-rail",
      "jitterRatio must be between 0 and 1"
    );
  }
  if (config.maxDelayMs < config.baseDelayMs) {
    throw new PaymentRailError(
      "invalid_configuration",
      "payment-rail",
      "maxDelayMs must be at least baseDelayMs"
    );
  }
  return config;
}

function errorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

function statusCode(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const status = (error as { status?: unknown }).status;
  if (typeof status === "number") return status;
  const response = (error as { response?: { status?: unknown } }).response;
  return typeof response?.status === "number" ? response.status : undefined;
}

/** Conservative default classifier: only transient transport/status failures retry. */
export function isRetryablePaymentRailError(error: unknown): boolean {
  if (error instanceof PaymentRailError) return error.retryable;
  if (typeof error === "object" && error !== null) {
    const retryable = (error as { retryable?: unknown }).retryable;
    if (typeof retryable === "boolean") return retryable;
  }
  const status = statusCode(error);
  if (status !== undefined)
    return status === 408 || status === 425 || status === 429 || status >= 500;
  return new Set([
    "ECONNRESET",
    "ECONNREFUSED",
    "ETIMEDOUT",
    "EAI_AGAIN",
    "UND_ERR_CONNECT_TIMEOUT",
  ]).has(errorCode(error) ?? "");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "payment rail request failed";
}

function backoffDelay(
  attempt: number,
  config: ResolvedConfig,
  random: () => number
): number {
  const exponential = Math.min(
    config.maxDelayMs,
    config.baseDelayMs * 2 ** (attempt - 1)
  );
  const spread = exponential * config.jitterRatio;
  const jitter = (random() * 2 - 1) * spread;
  return Math.max(0, Math.round(Math.min(config.maxDelayMs, exponential + jitter)));
}

/** A single dependency's closed/open/half-open state machine. */
export class PaymentRailCircuitBreaker {
  private state: CircuitState = "closed";
  private consecutiveFailures = 0;
  private openedAt = 0;
  private readonly config: CircuitBreakerConfig;

  constructor(config: CircuitBreakerConfig) {
    this.config = {
      failureThreshold: positiveInteger(config.failureThreshold, "failureThreshold"),
      cooldownMs: nonNegativeNumber(config.cooldownMs, "cooldownMs"),
    };
  }

  getState(now = Date.now()): CircuitState {
    if (this.state === "open" && now - this.openedAt >= this.config.cooldownMs) {
      return "half_open";
    }
    return this.state;
  }

  allowRequest(now = Date.now()): boolean {
    const current = this.getState(now);
    if (current === "closed") return true;
    if (current === "half_open") {
      this.state = "half_open";
      return true;
    }
    return false;
  }

  recordSuccess(): void {
    this.state = "closed";
    this.consecutiveFailures = 0;
    this.openedAt = 0;
  }

  recordFailure(now = Date.now()): boolean {
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= this.config.failureThreshold) {
      this.state = "open";
      this.openedAt = now;
      return true;
    }
    return false;
  }

  snapshot(now = Date.now()): {
    state: CircuitState;
    consecutiveFailures: number;
    openedAt: number;
  } {
    return {
      state: this.getState(now),
      consecutiveFailures: this.consecutiveFailures,
      openedAt: this.openedAt,
    };
  }
}

/** Registry-backed executor: each dependency receives an independent breaker. */
export class PaymentRailResilience {
  private readonly breakers = new Map<string, PaymentRailCircuitBreaker>();

  async execute<T>(
    operation: () => Promise<T>,
    options: PaymentRailExecutionOptions
  ): Promise<T> {
    const config = resolveConfig(options.config);
    const now = options.now ?? Date.now;
    const sleep =
      options.sleep ??
      ((delayMs: number) =>
        new Promise<void>((resolve) => setTimeout(resolve, delayMs)));
    const random = options.random ?? Math.random;
    const classify = options.isRetryable ?? isRetryablePaymentRailError;
    const breaker = this.breaker(options.dependency, config);
    const initialState = breaker.getState(now());

    if (!breaker.allowRequest(now())) {
      this.emit(options, {
        dependency: options.dependency,
        event: "circuit_rejected",
        state: "open",
      });
      throw new PaymentRailError(
        "circuit_open",
        options.dependency,
        `${options.dependency} circuit is open`,
        { retryable: true }
      );
    }
    if (initialState === "half_open") {
      this.emit(options, {
        dependency: options.dependency,
        event: "circuit_probe",
        state: "half_open",
      });
    }

    const maxAttempts = options.idempotent ? config.maxAttempts : 1;
    let attempt = 0;
    while (attempt < maxAttempts) {
      attempt += 1;
      this.emit(options, {
        dependency: options.dependency,
        event: "attempt",
        attempt,
        state: breaker.getState(now()),
      });
      try {
        const result = await operation();
        breaker.recordSuccess();
        this.emit(options, {
          dependency: options.dependency,
          event: "success",
          attempt,
          state: "closed",
        });
        return result;
      } catch (error) {
        const retryable = classify(error);
        const exhausted = attempt >= maxAttempts || !options.idempotent || !retryable;
        const opened = breaker.recordFailure(now());
        if (opened) {
          this.emit(options, {
            dependency: options.dependency,
            event: "circuit_opened",
            attempt,
            state: "open",
          });
        }
        if (exhausted) {
          const code: PaymentRailErrorCode = retryable
            ? "upstream_unavailable"
            : "upstream_rejected";
          const terminal = new PaymentRailError(
            code,
            options.dependency,
            `${options.dependency} ${errorMessage(error)}`,
            { attempts: attempt, retryable, cause: error }
          );
          this.emit(options, {
            dependency: options.dependency,
            event: "failure",
            attempt,
            state: breaker.getState(now()),
            errorCode: terminal.code,
          });
          throw terminal;
        }
        const delayMs = backoffDelay(attempt, config, random);
        this.emit(options, {
          dependency: options.dependency,
          event: "retry_scheduled",
          attempt,
          delayMs,
          state: breaker.getState(now()),
        });
        options.logger?.(
          {
            dependency: options.dependency,
            attempt,
            delayMs,
            state: breaker.getState(now()),
            error,
          },
          "retrying payment rail request"
        );
        await sleep(delayMs);
      }
    }
    throw new PaymentRailError(
      "upstream_unavailable",
      options.dependency,
      "payment rail request exhausted",
      { retryable: true }
    );
  }

  getBreakerSnapshot(
    dependency: string,
    now = Date.now()
  ): ReturnType<PaymentRailCircuitBreaker["snapshot"]> | undefined {
    return this.breakers.get(dependency)?.snapshot(now);
  }

  private breaker(
    dependency: string,
    config: ResolvedConfig
  ): PaymentRailCircuitBreaker {
    const existing = this.breakers.get(dependency);
    if (existing) return existing;
    const created = new PaymentRailCircuitBreaker(config);
    this.breakers.set(dependency, created);
    return created;
  }

  private emit(options: PaymentRailExecutionOptions, metric: PaymentRailMetric): void {
    options.onMetric?.(metric);
  }
}

/** Convenience entry point for a shared resilience registry. */
export const paymentRailResilience = new PaymentRailResilience();

export function executePaymentRail<T>(
  operation: () => Promise<T>,
  options: PaymentRailExecutionOptions
): Promise<T> {
  return paymentRailResilience.execute(operation, options);
}
