import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { createApp } from "./index.js";
import { servicesDisabled, servicesMetadata, servicesStore } from "./store/state.js";

const app = createApp();

type ListedService = {
  serviceId: string;
  priceStroops: number;
  disabled: boolean;
};

function seedService(serviceId: string, priceStroops: number, disabled = false) {
  servicesStore.set(serviceId, { priceStroops });
  if (disabled) servicesDisabled.add(serviceId);
}

async function listServices(query = "") {
  const res = await request(app).get(`/api/v1/services${query}`);
  assert.strictEqual(res.status, 200);
  return res;
}

function serviceIds(services: ListedService[]) {
  return services.map((service) => service.serviceId);
}

beforeEach(() => {
  servicesDisabled.clear();
  servicesMetadata.clear();
  servicesStore.clear();
});

void describe("GET /api/v1/services filters", () => {
  void it("filters by disabled=true and disabled=false", async () => {
    seedService("svc-enabled", 10);
    seedService("svc-disabled", 20, true);

    const disabled = await listServices("?disabled=true");
    assert.deepStrictEqual(serviceIds(disabled.body.services as ListedService[]), [
      "svc-disabled",
    ]);
    assert.strictEqual(disabled.body.services[0].disabled, true);

    const enabled = await listServices("?disabled=false");
    assert.deepStrictEqual(serviceIds(enabled.body.services as ListedService[]), [
      "svc-enabled",
    ]);
    assert.strictEqual(enabled.body.services[0].disabled, false);
  });

  void it("combines prefix, q, disabled, and inclusive price-range filters", async () => {
    seedService("filter-alpha-basic", 100, true);
    seedService("filter-alpha-premium", 250, true);
    seedService("filter-alpha-enterprise", 500, true);
    seedService("filter-beta-premium", 250, true);
    seedService("filter-alpha-premium-enabled", 250);

    const res = await listServices(
      "?prefix=filter-alpha&q=premium&disabled=true&minPrice=200&maxPrice=300"
    );

    assert.deepStrictEqual(serviceIds(res.body.services as ListedService[]), [
      "filter-alpha-premium",
    ]);
    assert.strictEqual(res.body.services[0].priceStroops, 250);
  });

  void it("ignores malformed price filters and non-literal disabled values", async () => {
    seedService("svc-cheap", 1);
    seedService("svc-expensive", 900, true);

    const res = await listServices("?minPrice=cheap&maxPrice=expensive&disabled=yes");

    assert.deepStrictEqual(serviceIds(res.body.services as ListedService[]), [
      "svc-cheap",
      "svc-expensive",
    ]);
  });

  void it("returns no services when minPrice is greater than maxPrice", async () => {
    seedService("svc-mid", 50);

    const res = await listServices("?minPrice=100&maxPrice=10");

    assert.deepStrictEqual(res.body.services, []);
  });

  void it("applies limit after all filters", async () => {
    seedService("svc-enabled", 5);
    seedService("svc-disabled-a", 10, true);
    seedService("svc-disabled-b", 20, true);
    seedService("svc-disabled-c", 30, true);

    const res = await listServices("?disabled=true&limit=2");

    assert.strictEqual(res.body.services.length, 2);
    assert.deepStrictEqual(serviceIds(res.body.services as ListedService[]), [
      "svc-disabled-a",
      "svc-disabled-b",
    ]);
    assert.ok(
      (res.body.services as ListedService[]).every((service) => service.disabled)
    );
  });

  void it("uses the filtered body when calculating list ETags", async () => {
    seedService("svc-enabled", 10);
    seedService("svc-disabled", 10, true);

    const enabled = await listServices("?disabled=false");
    const enabledEtag = enabled.headers.etag as string;
    assert.ok(enabledEtag, "enabled ETag missing");

    const disabledWithEnabledEtag = await request(app)
      .get("/api/v1/services?disabled=true")
      .set("If-None-Match", enabledEtag);
    assert.strictEqual(disabledWithEnabledEtag.status, 200);
    assert.notStrictEqual(disabledWithEnabledEtag.headers.etag, enabledEtag);

    const disabledEtag = disabledWithEnabledEtag.headers.etag as string;
    const repeatDisabled = await request(app)
      .get("/api/v1/services?disabled=true")
      .set("If-None-Match", disabledEtag);
    assert.strictEqual(repeatDisabled.status, 304);
  });
});
