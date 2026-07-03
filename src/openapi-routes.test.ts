import { describe, it } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { createApp } from "./index.js";

type RouteLayer = {
  route?: {
    path: string;
    methods: Record<string, boolean>;
  };
  handle?: {
    stack?: RouteLayer[];
  };
};

type ExpressAppWithRouter = {
  router?: {
    stack?: RouteLayer[];
  };
};

function toOpenApiPath(path: string): string {
  return path.replace(/:([A-Za-z0-9_]+)/g, "{$1}");
}

function registeredRoutes(stack: RouteLayer[] = []): {
  method: string;
  path: string;
}[] {
  const routes: { method: string; path: string }[] = [];
  for (const layer of stack) {
    if (layer.route) {
      for (const method of Object.keys(layer.route.methods)) {
        routes.push({ method, path: toOpenApiPath(layer.route.path) });
      }
      continue;
    }
    routes.push(...registeredRoutes(layer.handle?.stack));
  }
  return routes.sort((a, b) =>
    `${a.path} ${a.method}`.localeCompare(`${b.path} ${b.method}`)
  );
}

void describe("OpenAPI route parity", () => {
  void it("documents every registered primary route in the served OpenAPI paths", async () => {
    const app = createApp();
    const routeStack = (app as unknown as ExpressAppWithRouter).router?.stack ?? [];

    const res = await request(app).get("/api/v1/openapi.json");

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.openapi, "3.0.3");
    const paths = res.body.paths as Record<string, Record<string, unknown>>;
    const missing = registeredRoutes(routeStack).filter(
      ({ method, path }) => !paths[path]?.[method]
    );
    assert.deepStrictEqual(missing, []);
  });
});
