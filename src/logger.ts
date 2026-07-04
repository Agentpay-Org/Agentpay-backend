import pino, { type DestinationStream, type Logger, type LoggerOptions } from "pino";

const LOG_LEVELS = new Set([
  "fatal",
  "error",
  "warn",
  "info",
  "debug",
  "trace",
  "silent",
]);

const REDACT_PATHS = [
  "apiKey",
  "generatedKey",
  "key",
  "*.apiKey",
  "*.generatedKey",
  "*.key",
  'headers["x-api-key"]',
  'headers["X-API-Key"]',
  'req.headers["x-api-key"]',
  'req.headers["X-API-Key"]',
];

type CreateLoggerOptions = {
  level?: string;
  destination?: DestinationStream;
};

type RequestCompletionFields = {
  requestId?: string;
  method: string;
  path: string;
  status: number;
  durationMs: number;
};

function normalizeLogLevel(level: string | undefined): string {
  if (level && LOG_LEVELS.has(level)) return level;
  if (process.env.NODE_ENV === "test") return "silent";
  return "info";
}

/**
 * Builds the shared structured logger with environment-aware level selection
 * and defensive redaction for API-key shaped fields.
 */
export function createLogger(options: CreateLoggerOptions = {}): Logger {
  const loggerOptions: LoggerOptions = {
    level: normalizeLogLevel(options.level ?? process.env.LOG_LEVEL),
    redact: {
      paths: REDACT_PATHS,
      censor: "[Redacted]",
    },
    serializers: {
      err: pino.stdSerializers.err,
    },
  };

  if (options.destination) {
    return pino(loggerOptions, options.destination);
  }
  return pino(loggerOptions);
}

export const logger = createLogger();

export function logRequestCompletion(
  log: Logger,
  fields: RequestCompletionFields
): void {
  log.info(fields, "request completed");
}

export function logServerStarted(log: Logger, port: string | number): void {
  log.info({ port }, "server started");
}

export function logShutdownSignal(log: Logger, signal: string): void {
  log.info({ signal }, "shutdown signal received");
}

export function logServerCloseError(log: Logger, err: unknown): void {
  log.error({ err }, "server close failed");
}

export function logForcedShutdown(log: Logger, timeoutMs: number): void {
  log.error({ timeoutMs }, "forced exit after drain timeout");
}
