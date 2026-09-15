import test from "node:test";
import assert from "node:assert/strict";

const BASE_URL = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3000";
const INGRESS_PATH = "/api/hassio_ingress/automated-test";

async function waitUntilReady() {
  for (let attempt = 0; attempt < 45; attempt += 1) {
    try {
      const response = await fetch(`${BASE_URL}/api/ready`, {
        signal: AbortSignal.timeout(1000),
      });
      if (response.ok) return;
    } catch {
      // Host port publishing can lag behind container readiness on Docker Desktop.
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Ingress proxy did not become ready at ${BASE_URL}`);
}

test.before(waitUntilReady);
const INGRESS_HEADERS = { "X-Ingress-Path": INGRESS_PATH };

async function request(pathname, options = {}) {
  return fetch(`${BASE_URL}${pathname}`, {
    redirect: "manual",
    ...options,
  });
}

function findNextAsset(html) {
  const match = /(?:href|src)="(\.?\/_next\/static\/[^"?#]+)[^\"]*"/.exec(html);
  assert.ok(match, "HTML should reference a hashed Next.js static asset");
  return match[1].replace(/^\./, "");
}

function findNextScripts(html) {
  const matches = [
    ...html.matchAll(/<script[^>]+src="(\.?\/_next\/static\/[^"?#]+\.js)[^"]*"/g),
  ];
  assert.ok(matches.length > 0, "HTML should reference hashed Next.js JavaScript chunks");
  return [...new Set(matches.map((match) => match[1].replace(/^\./, "")))];
}

test("direct responses use root assets and targeted cache headers", async () => {
  const page = await request("/");
  assert.equal(page.status, 200);
  assert.equal(page.headers.get("x-debug-ingress-path"), null);
  assert.equal(page.headers.get("cache-control"), "no-cache");

  const html = await page.text();
  assert.match(html, /(?:href|src)="\/_next\/static\//);
  assert.doesNotMatch(html, /(?:href|src)="\.\/_next\/static\//);

  const asset = await request(findNextAsset(html));
  assert.equal(asset.status, 200);
  assert.equal(
    asset.headers.get("cache-control"),
    "public, max-age=31536000, immutable"
  );

  const scriptResponses = await Promise.all(
    findNextScripts(html).map((scriptPath) => request(scriptPath))
  );
  assert.ok(scriptResponses.every((script) => script.status === 200));
  const scripts = (await Promise.all(scriptResponses.map((script) => script.text()))).join("\n");
  assert.doesNotMatch(
    scripts,
    /["']\.\/_next\//,
    "direct JavaScript must not retain the relative asset base used by ingress"
  );
});

test("Supervisor-style ingress keeps relative assets and supports navigation", async () => {
  const page = await request("/", { headers: INGRESS_HEADERS });
  assert.equal(page.status, 200);
  assert.equal(page.headers.get("x-debug-ingress-path"), null);
  assert.equal(page.headers.get("cache-control"), "no-cache");

  const html = await page.text();
  assert.match(html, /(?:href|src)="\.\/_next\/static\//);

  const asset = await request(findNextAsset(html), { headers: INGRESS_HEADERS });
  assert.equal(asset.status, 200);
  assert.equal(
    asset.headers.get("cache-control"),
    "public, max-age=31536000, immutable"
  );

  const people = await request("/people", { headers: INGRESS_HEADERS });
  assert.equal(people.status, 200);
  assert.equal(people.headers.get("cache-control"), "no-cache");

  const redirect = await request("/people/", { headers: INGRESS_HEADERS });
  assert.ok([307, 308].includes(redirect.status));
  assert.equal(redirect.headers.get("location"), `${INGRESS_PATH}/people`);
});

test("API responses are never cached through ingress", async () => {
  const health = await request("/api/health", { headers: INGRESS_HEADERS });
  assert.equal(health.status, 200);
  assert.equal(health.headers.get("cache-control"), "no-store");
  assert.equal(health.headers.get("x-debug-ingress-path"), null);
  assert.equal((await health.json()).status, "ok");
});
