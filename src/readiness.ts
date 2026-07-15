let shuttingDown = false;

/** Returns true while the process should still receive new traffic. */
export function isReady(): boolean {
  return !shuttingDown;
}

/** Marks the process as draining so readiness probes can fail fast. */
export function markShuttingDown(): void {
  shuttingDown = true;
}

/** Resets readiness state for tests that exercise shutdown behavior in-process. */
export function resetReadiness(): void {
  shuttingDown = false;
}
