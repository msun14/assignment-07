// Request-level production checks without binding a network port or driving a browser.
// Uses Next's request mocks, matched to the exact Next version in package-lock.json.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import nextServerModule from "next/dist/server/next-server.js";
import mockModule from "next/dist/server/lib/mock-request.js";

process.env.NODE_ENV = "production";
const NextServer = nextServerModule.default ?? nextServerModule;
const conf = JSON.parse(readFileSync(".next/required-server-files.json", "utf8")).config;
const server = new NextServer({ conf, dir: process.cwd(), dev: false, hostname: "localhost", port: 3000, quiet: true });
const handler = server.getRequestHandler();

async function request(url) {
  const { req, res } = mockModule.createRequestResponseMocks({ url, headers: { host: "localhost:3000" }, method: "GET" });
  await handler(req, res);
  await res.hasStreamed;
  return { status: res.statusCode, body: Buffer.concat(res.buffers).toString(), location: res.getHeader("location") };
}

try {
  const home = await request("/");
  assert.equal(home.status, 200);
  assert.ok(home.body.includes('href="#সব-পণ্য"'));
  assert.ok(home.body.includes('id="সব-পণ্য"'));
  assert.ok(home.body.includes('/product/miniket-chal'));
  console.log("PASS home render, same-page CTA and product links");
  for (const path of ["/category/chal", "/category/sobji", "/signin", "/signup"]) {
    const result = await request(path);
    assert.equal(result.status, 200, path);
    assert.ok(!result.body.includes('"digest":"') || !result.body.includes('NEXT_HTTP_ERROR_FALLBACK;500'), path);
    console.log(`PASS direct route ${path}`);
  }
  for (const path of ["/product/miniket-chal", "/profile", "/profile/edit"]) {
    const result = await request(path);
    const target = `/signin?reason=protected&next=${encodeURIComponent(path)}`;
    // Streaming may carry the redirect in the RSC payload instead of an HTTP 307.
    assert.ok(String(result.location).includes(target) || result.body.includes(target.replaceAll("&", "&amp;")) || result.body.includes(target), path);
    assert.ok(!result.body.includes('<table class="market-table"'), "protected market table must not be rendered");
    console.log(`PASS server-protected route ${path}`);
  }
  for (const path of ["/category/invalid", "/product/unknown", "/not-a-real-page"]) {
    const result = await request(path);
    assert.ok(result.status === 404 || result.body.includes('NEXT_HTTP_ERROR_FALLBACK;404'), path);
    assert.ok(result.body.includes("পৃষ্ঠাটি খুঁজে পাওয়া যায়নি"), path);
    console.log(`PASS friendly not-found ${path}`);
  }
} finally { await server.close(); }
