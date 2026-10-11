import { test } from "node:test";
import assert from "node:assert/strict";
import { bn, numeric, safeReturnPath, sortProducts, topMovers, marketSummary } from "../src/lib/format";
import { normalizeCategory, normalizeProduct } from "../src/lib/normalize";
import { validateAuth } from "../src/lib/validation";
import rawProducts from "../src/data/products.snapshot.json";
import rawCategories from "../src/data/categories.snapshot.json";

const products = rawProducts.map(normalizeProduct);
test("official API snapshot has all 33 valid products and eight linked categories", () => {
  assert.equal(products.length, 33);
  const categories = rawCategories.map(normalizeCategory);
  assert.equal(categories.length, 8);
  assert.equal(new Set(products.map((p) => p.slug)).size, products.length);
  for (const product of products) {
    assert.ok(categories.some((category) => category.slug === product.category));
    assert.equal(product.markets.length, 12);
    assert.match(product.slug, /^[a-z0-9-]+$/);
  }
});
test("Bengali and English digits sort as numbers, with stable defaults", () => {
  assert.equal(numeric("১,৮৫০.৫০"), 1850.5);
  assert.equal(numeric("৯৯"), 99);
  assert.ok(Number.isNaN(numeric("")));
  const normalized = ["৯৯", "১৪৮", "৩০"].map((today, index) => normalizeProduct({ ...rawProducts[index], today }));
  assert.deepEqual(sortProducts(normalized, "asc").map((p) => p.today), [30, 99, 148]);
  assert.deepEqual(sortProducts(normalized, "desc").map((p) => p.today), [148, 99, 30]);
  assert.deepEqual(sortProducts(normalized, "default").map((p) => p.today), [99, 148, 30]);
  assert.match(bn(1850), /১.*৮৫০/);
});
test("top six movers use the percentage magnitude in the right direction", () => {
  const up = topMovers(products, "up"), down = topMovers(products, "down");
  assert.equal(up.length, 6); assert.equal(down.length, 6);
  assert.equal(up[0].slug, "peyaj"); assert.equal(down[0].slug, "kaccha-moric");
  assert.ok(up.every((p) => p.today > p.yesterday));
  assert.ok(down.every((p) => p.today < p.yesterday));
});
test("market summary calculates actual market extrema and the mean of midpoints", () => {
  const product = { ...products[0], markets: [{ market: "A", division: "ঢাকা", min: 10, max: 30 }, { market: "B", division: "ঢাকা", min: 20, max: 50 }] };
  assert.deepEqual(marketSummary(product), { minimum: 10, maximum: 50, average: 27.5 });
  assert.equal(marketSummary({ ...product, markets: [] }), null);
});
test("redirect destinations remain same-origin and avoid auth loops", () => {
  for (const invalid of ["https://example.com", "//example.com", "/\\example.com", "/signin", "/api/auth/get-session", "/foo\nbar"]) assert.equal(safeReturnPath(invalid), "/");
  assert.equal(safeReturnPath("/product/miniket-chal"), "/product/miniket-chal");
  assert.equal(safeReturnPath("/category/chal?sort=asc"), "/category/chal?sort=asc");
});
test("registration validates names, emails, passwords and confirmation", () => {
  const errors = validateAuth({ name: "", email: "wrong", password: "short", confirmPassword: "other" }, true);
  assert.deepEqual(Object.keys(errors), ["name", "email", "password", "confirmPassword"]);
  assert.deepEqual(validateAuth({ name: "রহিম", email: "examiner@example.com", password: "SafePassword123!", confirmPassword: "SafePassword123!" }, true), {});
  assert.deepEqual(validateAuth({ email: "examiner@example.com", password: "SafePassword123!" }, false), {});
});
