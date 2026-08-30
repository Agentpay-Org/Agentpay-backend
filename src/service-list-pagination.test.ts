import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import request from "supertest";
import { app } from "./index.js";
import {
  DEFAULT_SERVICE_PAGE_SIZE,
  MAX_SERVICE_PAGE_SIZE,
  ServiceCursorError,
  compareServiceIds,
  decodeServiceCursor,
  encodeServiceCursor,
  normalizeServicePageSize,
  serviceListScope,
} from "./serviceListPagination.js";
import { servicesDisabled, servicesMetadata, servicesStore } from "./store/state.js";

const scope = serviceListScope("public");

function seed(serviceId: string, priceStroops = 10): void {
  servicesStore.set(serviceId, { priceStroops });
}

function serviceIds(body: unknown): string[] {
  if (body === null || typeof body !== "object")
    throw new TypeError("body is not an object");
  const services = (body as { services?: unknown }).services;
  if (!Array.isArray(services)) throw new TypeError("services is not an array");
  return services.map((service) => {
    if (service === null || typeof service !== "object")
      throw new TypeError("service is not an object");
    const id = (service as { serviceId?: unknown }).serviceId;
    if (typeof id !== "string") throw new TypeError("service id is not a string");
    return id;
  });
}

function assertErrorBody(body: unknown, message: string): void {
  assert.deepEqual(body, {
    error: "invalid_request",
    code: "invalid_cursor",
    message,
    requestId:
      body !== null && typeof body === "object"
        ? (body as { requestId?: string }).requestId
        : undefined,
  });
  assert.equal(typeof (body as { requestId: unknown }).requestId, "string");
}

void describe("service cursor primitives", () => {
  void it("uses bounded defaults at the service boundary", () => {
    assert.equal(DEFAULT_SERVICE_PAGE_SIZE, 100);
    assert.equal(MAX_SERVICE_PAGE_SIZE, 100);
    assert.equal(normalizeServicePageSize(undefined), 100);
    assert.equal(normalizeServicePageSize(""), 100);
    assert.equal(normalizeServicePageSize("not-a-number"), 100);
    assert.equal(normalizeServicePageSize("0"), 1);
    assert.equal(normalizeServicePageSize("-20"), 1);
    assert.equal(normalizeServicePageSize("1.9"), 1);
    assert.equal(normalizeServicePageSize("9999"), 100);
  });

  void it("orders service ids independently of insertion order or locale", () => {
    const ids = ["svc-10", "svc-2", "svc-a", "svc-1"];
    assert.deepEqual(ids.sort(compareServiceIds), [
      "svc-1",
      "svc-10",
      "svc-2",
      "svc-a",
    ]);
    assert.equal(compareServiceIds("same", "same"), 0);
    assert.equal(compareServiceIds("a", "b") < 0, true);
    assert.equal(compareServiceIds("b", "a") > 0, true);
  });

  void it("round-trips an opaque signed position", () => {
    const cursor = encodeServiceCursor("svc-42", scope, 1000);
    const [payload, signature] = cursor.split(".");

    assert.match(cursor, /^[A-Za-z0-9_-]+\.[a-f0-9]{64}$/);
    assert.equal(payload.includes("svc-42"), false);
    assert.equal(signature.length, 64);
    assert.equal(decodeServiceCursor(cursor, scope, 1001), "svc-42");
  });

  void it("rejects malformed cursor shapes", () => {
    for (const malformed of [
      "",
      "not-base64",
      ".signature",
      "payload.",
      "payload.short",
    ]) {
      assert.throws(() => decodeServiceCursor(malformed, scope), ServiceCursorError);
    }
  });

  void it("rejects tampering before accepting a changed service position", () => {
    const cursor = encodeServiceCursor("svc-1", scope, 1000);
    const tampered = `${cursor.slice(0, -1)}${cursor.endsWith("0") ? "1" : "0"}`;

    assert.throws(() => decodeServiceCursor(tampered, scope, 1001), ServiceCursorError);
  });

  void it("rejects future and expired positions", () => {
    const future = encodeServiceCursor("svc-1", scope, 2000);
    assert.throws(() => decodeServiceCursor(future, scope, 1000), /expired/);

    const previousTtl = process.env.SERVICE_CURSOR_TTL_MS;
    process.env.SERVICE_CURSOR_TTL_MS = "100";
    try {
      const old = encodeServiceCursor("svc-1", scope, 1000);
      assert.throws(() => decodeServiceCursor(old, scope, 1101), /expired/);
    } finally {
      if (previousTtl === undefined) delete process.env.SERVICE_CURSOR_TTL_MS;
      else process.env.SERVICE_CURSOR_TTL_MS = previousTtl;
    }
  });

  void it("binds the cursor to tenant and every active filter", () => {
    const filtered = serviceListScope("public", {
      prefix: "svc-",
      q: "alpha",
      disabled: false,
      minPrice: 1,
      maxPrice: 100,
    });
    const cursor = encodeServiceCursor("svc-1", filtered, 1000);

    assert.equal(decodeServiceCursor(cursor, filtered, 1001), "svc-1");
    assert.throws(
      () => decodeServiceCursor(cursor, serviceListScope("other")),
      /match/
    );
    assert.throws(
      () =>
        decodeServiceCursor(
          cursor,
          serviceListScope("public", {
            prefix: "svc-",
            q: "beta",
            disabled: false,
            minPrice: 1,
            maxPrice: 100,
          })
        ),
      /match/
    );
  });
});

void describe("GET /api/v1/services cursor pagination", () => {
  void it("returns stable sorted pages with an opaque continuation", async () => {
    for (const id of ["svc-c", "svc-a", "svc-e", "svc-b", "svc-d"]) seed(id);

    const first = await request(app).get("/api/v1/services?limit=2");
    assert.equal(first.status, 200);
    assert.deepEqual(serviceIds(first.body), ["svc-a", "svc-b"]);
    assert.equal(first.body.total, 5);
    assert.equal(first.body.limit, 2);
    assert.equal(typeof first.body.nextCursor, "string");
    assert.equal(first.body.nextCursor.includes("svc-b"), false);

    const second = await request(app)
      .get("/api/v1/services")
      .query({ limit: 2, cursor: first.body.nextCursor });
    assert.equal(second.status, 200);
    assert.deepEqual(serviceIds(second.body), ["svc-c", "svc-d"]);
    assert.equal(second.body.nextCursor !== null, true);

    const third = await request(app)
      .get("/api/v1/services")
      .query({ limit: 2, cursor: second.body.nextCursor });
    assert.equal(third.status, 200);
    assert.deepEqual(serviceIds(third.body), ["svc-e"]);
    assert.equal(third.body.nextCursor, null);
    assert.deepEqual(
      [
        ...serviceIds(first.body),
        ...serviceIds(second.body),
        ...serviceIds(third.body),
      ],
      ["svc-a", "svc-b", "svc-c", "svc-d", "svc-e"]
    );
  });

  void it("does not repeat existing rows when services are inserted mid-scan", async () => {
    for (const id of ["svc-b", "svc-d", "svc-f"]) seed(id);
    const first = await request(app).get("/api/v1/services?limit=2");
    assert.deepEqual(serviceIds(first.body), ["svc-b", "svc-d"]);

    seed("svc-a");
    seed("svc-e");
    const second = await request(app)
      .get("/api/v1/services")
      .query({ limit: 2, cursor: first.body.nextCursor });

    assert.equal(second.status, 200);
    assert.deepEqual(serviceIds(second.body), ["svc-e", "svc-f"]);
    assert.deepEqual(
      new Set([...serviceIds(first.body), ...serviceIds(second.body)]),
      new Set(["svc-b", "svc-d", "svc-e", "svc-f"])
    );
  });

  void it("keeps filters in the cursor scope", async () => {
    seed("svc-filter-a", 10);
    seed("svc-filter-b", 20);
    seed("svc-other", 30);
    const first = await request(app).get("/api/v1/services?prefix=svc-filter&limit=1");
    assert.equal(first.status, 200);

    const changed = await request(app).get("/api/v1/services").query({
      prefix: "svc-other",
      cursor: first.body.nextCursor,
    });
    assert.equal(changed.status, 400);
    assert.equal(changed.body.code, "invalid_cursor");
  });

  void it("returns 400 for malformed, tampered, and expired cursors", async () => {
    seed("svc-invalid");
    const malformed = await request(app).get("/api/v1/services?cursor=not-a-cursor");
    assert.equal(malformed.status, 400);
    assertErrorBody(malformed.body, "cursor is malformed");

    const valid = encodeServiceCursor("svc-invalid", scope);
    const tampered = `${valid.slice(0, -1)}${valid.endsWith("0") ? "1" : "0"}`;
    const invalid = await request(app).get(`/api/v1/services?cursor=${tampered}`);
    assert.equal(invalid.status, 400);
    assertErrorBody(invalid.body, "cursor is invalid");

    const previousTtl = process.env.SERVICE_CURSOR_TTL_MS;
    process.env.SERVICE_CURSOR_TTL_MS = "1";
    try {
      const expired = encodeServiceCursor("svc-invalid", scope, Date.now() - 100);
      const response = await request(app).get(`/api/v1/services?cursor=${expired}`);
      assert.equal(response.status, 400);
      assertErrorBody(response.body, "cursor is expired");
    } finally {
      if (previousTtl === undefined) delete process.env.SERVICE_CURSOR_TTL_MS;
      else process.env.SERVICE_CURSOR_TTL_MS = previousTtl;
    }
  });

  void it("clamps oversized pages and retains the stable envelope", async () => {
    for (let index = 0; index < 105; index += 1)
      seed(`svc-page-${String(index).padStart(3, "0")}`);
    const response = await request(app).get("/api/v1/services?limit=9999");

    assert.equal(response.status, 200);
    assert.equal(response.body.services.length, 100);
    assert.equal(response.body.total, 105);
    assert.equal(response.body.limit, 100);
    assert.equal(typeof response.body.nextCursor, "string");
  });

  void it("returns a null cursor at the end of a filtered result", async () => {
    seed("svc-end-a");
    const response = await request(app).get(
      "/api/v1/services?prefix=svc-end&limit=100"
    );

    assert.equal(response.status, 200);
    assert.deepEqual(serviceIds(response.body), ["svc-end-a"]);
    assert.equal(response.body.nextCursor, null);
  });
});

beforeEach(() => {
  servicesStore.clear();
  servicesDisabled.clear();
  servicesMetadata.clear();
});
