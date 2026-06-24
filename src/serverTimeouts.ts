import type { Server } from "node:http";

export type ServerTimeoutConfig = {
  requestTimeoutMs: number;
  headersTimeoutMs: number;
  keepAliveTimeoutMs: number;
};

const DEFAULT_REQUEST_TIMEOUT_MS = 120_000;
const DEFAULT_HEADERS_TIMEOUT_MS = 65_000;
const DEFAULT_KEEPALIVE_TIMEOUT_MS = 5_000;

function readPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.trunc(parsed);
}

/**
 * Applies bounded HTTP server timeouts so slow or incomplete clients cannot
 * hold sockets indefinitely. Headers timeout is raised when needed to preserve
 * Node's headersTimeout >= keepAliveTimeout invariant.
 */
export function configureServerTimeouts(
  server: Server,
  env: NodeJS.ProcessEnv = process.env
): ServerTimeoutConfig {
  const requestTimeoutMs = readPositiveInt(
    env.REQUEST_TIMEOUT_MS,
    DEFAULT_REQUEST_TIMEOUT_MS
  );
  const keepAliveTimeoutMs = readPositiveInt(
    env.KEEPALIVE_TIMEOUT_MS,
    DEFAULT_KEEPALIVE_TIMEOUT_MS
  );
  const requestedHeadersTimeoutMs = readPositiveInt(
    env.HEADERS_TIMEOUT_MS,
    DEFAULT_HEADERS_TIMEOUT_MS
  );
  const headersTimeoutMs = Math.max(requestedHeadersTimeoutMs, keepAliveTimeoutMs);

  server.requestTimeout = requestTimeoutMs;
  server.headersTimeout = headersTimeoutMs;
  server.keepAliveTimeout = keepAliveTimeoutMs;
  server.setTimeout(requestTimeoutMs, (socket) => {
    socket.destroy();
  });

  return { requestTimeoutMs, headersTimeoutMs, keepAliveTimeoutMs };
}
