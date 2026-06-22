import pino, { type DestinationStream, type Logger, type LoggerOptions } from "pino";

type CreateLoggerOptions = {
  level?: string;
  nodeEnv?: string;
  stream?: DestinationStream;
};

const REDACT_PATHS = [
  "key",
  "*.key",
  "*.*.key",
  "apiKey",
  "*.apiKey",
  "*.*.apiKey",
  "headers.authorization",
  'headers["x-api-key"]',
  "req.headers.authorization",
  'req.headers["x-api-key"]',
  "request.headers.authorization",
  'request.headers["x-api-key"]',
];

/**
 * Create the application logger. LOG_LEVEL controls verbosity; tests default
 * to silent so request logs never pollute test output unless a test injects
 * a level and stream explicitly.
 */
function createLogger(options: CreateLoggerOptions = {}): Logger {
  const nodeEnv = options.nodeEnv ?? process.env.NODE_ENV;
  const level =
    options.level ?? process.env.LOG_LEVEL ?? (nodeEnv === "test" ? "silent" : "info");
  const loggerOptions: LoggerOptions = {
    level,
    base: undefined,
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: REDACT_PATHS,
      censor: "[Redacted]",
    },
    serializers: {
      err: pino.stdSerializers.err,
    },
  };

  return options.stream ? pino(loggerOptions, options.stream) : pino(loggerOptions);
}

const logger = createLogger();

export { createLogger, logger };
