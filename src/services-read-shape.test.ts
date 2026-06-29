import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { createApp } from "./index.js";
import { servicesDisabled, servicesMetadata, servicesStore } from "./store/state.js";

const app = createApp();
let sequence = 0;

function serviceId(prefix = "svc-read-shape") {
  sequence += 1;
  return `${prefix}-${Date.now()}-${sequence}`;
}

async function createService(id: string, priceStroops = 100) {
  const res = await request(app)
    .post("/api/v1/services")
    .send({ serviceId: id, priceStroops });
  assert.strictEqual(res.status, 201);
}

beforeEach(() => {
  servicesDisabled.clear();
  servicesMetadata.clear();
  servicesStore.clear();
});

void describe("service read response shape", () => {
  void it("includes disabled state and metadata in list responses", async () => {
    const id = serviceId("svc-list-shape");
    await createService(id, 25);

    const metadata = await request(app)
      .put(`/api/v1/services/${id}/metadata`)
      .send({ description: "Embeddings endpoint", owner: "platform" });
    assert.strictEqual(metadata.status, 200);

    const disabled = await request(app)
      .patch(`/api/v1/services/${id}/disabled`)
      .send({ disabled: true });
    assert.strictEqual(disabled.status, 200);

    const res = await request(app).get(`/api/v1/services?prefix=${id}`);
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.body.services, [
      {
        serviceId: id,
        priceStroops: 25,
        disabled: true,
        description: "Embeddings endpoint",
        owner: "platform",
      },
    ]);
  });

  void it("returns disabled=false and omits metadata when none is configured", async () => {
    const id = serviceId("svc-detail-shape");
    await createService(id, 50);

    const detail = await request(app).get(`/api/v1/services/${id}`);
    assert.strictEqual(detail.status, 200);
    assert.deepStrictEqual(detail.body, {
      serviceId: id,
      priceStroops: 50,
      disabled: false,
    });
    assert.strictEqual("description" in detail.body, false);
    assert.strictEqual("owner" in detail.body, false);
  });

  void it("includes disabled state and metadata in single-service responses", async () => {
    const id = serviceId("svc-detail-metadata");
    await createService(id, 75);
    await request(app)
      .put(`/api/v1/services/${id}/metadata`)
      .send({ description: "Image generation", owner: "creative" });
    await request(app)
      .patch(`/api/v1/services/${id}/disabled`)
      .send({ disabled: true });

    const detail = await request(app).get(`/api/v1/services/${id}`);
    assert.strictEqual(detail.status, 200);
    assert.deepStrictEqual(detail.body, {
      serviceId: id,
      priceStroops: 75,
      disabled: true,
      description: "Image generation",
      owner: "creative",
    });
  });

  void it("changes the list ETag when disabled state changes", async () => {
    const id = serviceId("svc-etag-shape");
    await createService(id, 10);

    const first = await request(app).get(`/api/v1/services?prefix=${id}`);
    assert.strictEqual(first.status, 200);
    const firstEtag = first.headers.etag as string;
    assert.ok(firstEtag, "initial ETag missing");

    const disabled = await request(app)
      .patch(`/api/v1/services/${id}/disabled`)
      .send({ disabled: true });
    assert.strictEqual(disabled.status, 200);

    const second = await request(app)
      .get(`/api/v1/services?prefix=${id}`)
      .set("If-None-Match", firstEtag);
    assert.strictEqual(second.status, 200);
    assert.notStrictEqual(second.headers.etag, firstEtag);
    assert.strictEqual(second.body.services[0].disabled, true);

    const third = await request(app)
      .get(`/api/v1/services?prefix=${id}`)
      .set("If-None-Match", second.headers.etag as string);
    assert.strictEqual(third.status, 304);
  });
});
