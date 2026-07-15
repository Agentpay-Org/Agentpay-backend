import type { Request } from "express";

type HttpMetricLabels = {
  method: string;
  route: string;
  status: string;
};

type HttpMetricSample = HttpMetricLabels & {
  count: number;
  sumSeconds: number;
  buckets: Map<number, number>;
};

const DURATION_BUCKETS_SECONDS = [
  0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10,
];
const httpSamples = new Map<string, HttpMetricSample>();
const httpErrorCounts = new Map<string, number>();

/** Records one completed HTTP response for Prometheus counters and histograms. */
export function recordHttpRequest(
  req: Request,
  statusCode: number,
  durationSeconds: number
): void {
  const labels: HttpMetricLabels = {
    method: req.method.toUpperCase(),
    route: routePattern(req),
    status: String(statusCode),
  };
  const key = metricKey(labels);
  let sample = httpSamples.get(key);
  if (!sample) {
    sample = {
      ...labels,
      count: 0,
      sumSeconds: 0,
      buckets: new Map(DURATION_BUCKETS_SECONDS.map((bucket) => [bucket, 0])),
    };
    httpSamples.set(key, sample);
  }

  sample.count += 1;
  sample.sumSeconds += durationSeconds;
  for (const bucket of DURATION_BUCKETS_SECONDS) {
    if (durationSeconds <= bucket) {
      sample.buckets.set(bucket, (sample.buckets.get(bucket) ?? 0) + 1);
    }
  }
}

/** Records one terminal Express error-handler invocation. */
export function recordHttpError(type: string): void {
  httpErrorCounts.set(type, (httpErrorCounts.get(type) ?? 0) + 1);
}

/** Appends Prometheus request counters, histograms, and error counters. */
export function renderHttpMetrics(): string[] {
  const lines = [
    "# HELP agentpay_http_requests_total HTTP responses by method, route, and status.",
    "# TYPE agentpay_http_requests_total counter",
  ];

  for (const sample of sortedSamples()) {
    lines.push(`agentpay_http_requests_total${labelSet(sample)} ${sample.count}`);
  }

  lines.push(
    "# HELP agentpay_http_request_duration_seconds HTTP response duration in seconds.",
    "# TYPE agentpay_http_request_duration_seconds histogram"
  );
  for (const sample of sortedSamples()) {
    for (const bucket of DURATION_BUCKETS_SECONDS) {
      lines.push(
        `agentpay_http_request_duration_seconds_bucket${labelSet({
          ...sample,
          le: String(bucket),
        })} ${sample.buckets.get(bucket) ?? 0}`
      );
    }
    lines.push(
      `agentpay_http_request_duration_seconds_bucket${labelSet({
        ...sample,
        le: "+Inf",
      })} ${sample.count}`
    );
    lines.push(
      `agentpay_http_request_duration_seconds_sum${labelSet(sample)} ${formatNumber(
        sample.sumSeconds
      )}`
    );
    lines.push(
      `agentpay_http_request_duration_seconds_count${labelSet(sample)} ${sample.count}`
    );
  }

  lines.push(
    "# HELP agentpay_http_errors_total Terminal error-handler invocations by error type.",
    "# TYPE agentpay_http_errors_total counter"
  );
  for (const [type, count] of Array.from(httpErrorCounts.entries()).sort()) {
    lines.push(`agentpay_http_errors_total${labelSet({ type })} ${count}`);
  }

  return lines;
}

export function resetHttpMetrics(): void {
  httpSamples.clear();
  httpErrorCounts.clear();
}

function sortedSamples(): HttpMetricSample[] {
  return Array.from(httpSamples.values()).sort((a, b) =>
    metricKey(a).localeCompare(metricKey(b))
  );
}

function metricKey(labels: HttpMetricLabels): string {
  return `${labels.method}\n${labels.route}\n${labels.status}`;
}

function routePattern(req: Request): string {
  const routePath = req.route?.path;
  if (typeof routePath === "string") {
    return `${req.baseUrl}${routePath}`;
  }
  return "unmatched";
}

function labelSet(labels: Record<string, unknown>): string {
  const entries = Object.entries(labels).filter(([key]) =>
    ["method", "route", "status", "le", "type"].includes(key)
  );
  return `{${entries
    .map(([key, value]) => `${key}="${escapeLabelValue(labelValue(value))}"`)
    .join(",")}}`;
}

function labelValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
}

function escapeLabelValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/"/g, '\\"');
}

function formatNumber(value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
}
