import { describe, it } from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";
import request from "supertest";
import { app } from "./index.js";

const README_PATH = new URL("../README.md", import.meta.url);
const SOURCE_PATH = new URL("../src/index.ts", import.meta.url);

function routeKey(method: string, path: string) {
  return `${method.toUpperCase()} ${path}`;
}

function normalizeExpressPath(path: string) {
  return path.replace(/:([A-Za-z0-9_]+)/g, "{$1}");
}

function sorted(values: Iterable<string>) {
  return Array.from(values).sort();
}

function readmeRouteKeys() {
  const readme = readFileSync(README_PATH, "utf8");
  const sectionMatch =
    /<!-- api-reference:start -->([\s\S]*?)<!-- api-reference:end -->/.exec(readme);
  const section = sectionMatch?.[1];
  assert.ok(section, "README API reference markers are missing");

  const keys = new Set<string>();
  const rowPattern =
    /^\|\s*[^|]+\|\s*(GET|POST|PUT|PATCH|DELETE)\s*\|\s*`([^`]+)`\s*\|/gm;
  for (const match of section.matchAll(rowPattern)) {
    keys.add(routeKey(match[1], match[2]));
  }
  return keys;
}

function sourceRouteKeys() {
  const source = readFileSync(SOURCE_PATH, "utf8");
  const keys = new Set<string>();
  const routePattern = /app\.(get|post|put|patch|delete)\("([^"]+)"/g;
  for (const match of source.matchAll(routePattern)) {
    keys.add(routeKey(match[1], normalizeExpressPath(match[2])));
  }
  return keys;
}

async function openApiRouteKeys() {
  const res = await request(app).get("/api/v1/openapi.json");
  assert.strictEqual(res.status, 200);
  const paths = res.body.paths as Record<string, Record<string, unknown>>;
  const keys = new Set<string>();
  for (const [path, methods] of Object.entries(paths)) {
    for (const method of Object.keys(methods)) {
      keys.add(routeKey(method, path));
    }
  }
  return keys;
}

void describe("OpenAPI and README route parity", () => {
  void it("lists the same routes in README, OpenAPI, and Express registration", async () => {
    const fromReadme = readmeRouteKeys();
    const fromSource = sourceRouteKeys();
    const fromOpenApi = await openApiRouteKeys();

    assert.deepStrictEqual(sorted(fromReadme), sorted(fromOpenApi));
    assert.deepStrictEqual(sorted(fromOpenApi), sorted(fromSource));
  });
});
