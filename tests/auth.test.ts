import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { createBazarAuth } from "../src/lib/auth-config";
import * as schema from "../src/lib/db/schema";

test("real Better Auth lifecycle against PostgreSQL-compatible storage", async (t) => {
  const database = new PGlite();
  const sql = await readFile(new URL("../database/001_auth.sql", import.meta.url), "utf8");
  await database.exec(sql);
  await database.exec(sql); // A second deployment must not destroy accounts.
  const env = {
    BETTER_AUTH_SECRET: randomBytes(32).toString("hex"),
    BETTER_AUTH_URL: "http://localhost:3000",
    GOOGLE_CLIENT_ID: "test-google-client", GOOGLE_CLIENT_SECRET: "test-google-secret",
    GITHUB_CLIENT_ID: "test-github-client", GITHUB_CLIENT_SECRET: "test-github-secret",
  };
  const db = drizzle(database, { schema });
  const auth = createBazarAuth(db, env);
  const credentials = { name: "রহিম উদ্দিন", email: "examiner@example.com", password: "SafePassword123!" };
  let cookie = "";
  const call = (path: string, body?: object, sessionCookie = "", origin = env.BETTER_AUTH_URL, instance = auth) => instance.handler(new Request(`${env.BETTER_AUTH_URL}/api/auth${path}`, {
    method: body ? "POST" : "GET",
    headers: { ...(body ? { "Content-Type": "application/json" } : {}), Origin: origin, ...(sessionCookie ? { Cookie: sessionCookie } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  }));
  try {
    await t.test("reject weak passwords and unauthenticated profile writes", async () => {
      assert.equal((await call("/sign-up/email", { ...credentials, password: "bad" })).status, 400);
      assert.equal((await call("/update-user", { name: "Intruder" })).status, 401);
    });
    await t.test("register without email verification or automatic login", async () => {
      const response = await call("/sign-up/email", credentials);
      assert.equal(response.status, 200);
      const result = await response.json();
      assert.equal(result.user.email, credentials.email);
      assert.equal(result.token, null);
      const stored = await database.query<{ password: string }>('SELECT password FROM "account"');
      assert.equal(stored.rows.length, 1);
      assert.notEqual(stored.rows[0].password, credentials.password);
    });
    await t.test("duplicate registration does not overwrite the account", async () => {
      const response = await call("/sign-up/email", { ...credentials, password: "DifferentPassword123!" });
      // Better Auth masks duplicate emails when autoSignIn is false.
      assert.equal(response.status, 200);
      const stored = await database.query('SELECT id FROM "user"');
      assert.equal(stored.rows.length, 1);
    });
    await t.test("wrong password fails and valid login issues an HttpOnly session", async () => {
      assert.equal((await call("/sign-in/email", { email: credentials.email, password: "WrongPassword123!" })).status, 401);
      const response = await call("/sign-in/email", credentials);
      assert.equal(response.status, 200);
      const setCookie = response.headers.getSetCookie().find((value) => value.includes("session_token="));
      assert.ok(setCookie); assert.match(setCookie, /httponly/i); assert.match(setCookie, /samesite=lax/i);
      cookie = setCookie.split(";")[0];
    });
    await t.test("sessions survive another server instance and reject forged cookies", async () => {
      const newInstance = createBazarAuth(db, env);
      const response = await call("/get-session", undefined, cookie, env.BETTER_AUTH_URL, newInstance);
      assert.equal((await response.json()).user.name, credentials.name);
      assert.equal(await (await call("/get-session", undefined, "better-auth.session_token=forged")).json(), null);
    });
    await t.test("name update persists and appears on the next session read", async () => {
      const response = await call("/update-user", { name: "আপডেট করা নাম" }, cookie);
      assert.equal(response.status, 200);
      const session = await (await call("/get-session", undefined, cookie)).json();
      assert.equal(session.user.name, "আপডেট করা নাম");
    });
    await t.test("untrusted origins cannot modify an account", async () => {
      assert.equal((await call("/update-user", { name: "Intruder" }, cookie, "https://untrusted.example")).status, 403);
    });
    await t.test("Google and GitHub start the correct OAuth redirects", async () => {
      for (const provider of ["google", "github"]) {
        const response = await call("/sign-in/social", { provider, callbackURL: "/", disableRedirect: true });
        assert.equal(response.status, 200);
        const result = await response.json();
        const url = new URL(result.url);
        assert.ok(url.hostname.endsWith(provider === "google" ? "google.com" : "github.com"));
        assert.equal(url.searchParams.get("redirect_uri"), `${env.BETTER_AUTH_URL}/api/auth/callback/${provider}`);
        assert.ok(url.searchParams.get("state"));
        if (provider === "github") assert.match(url.searchParams.get("scope") || "", /user:email/);
      }
    });
    await t.test("logout revokes access even if the old cookie is reused", async () => {
      assert.equal((await call("/sign-out", {}, cookie)).status, 200);
      assert.equal(await (await call("/get-session", undefined, cookie)).json(), null);
      assert.equal((await call("/update-user", { name: "After logout" }, cookie)).status, 401);
    });
  } finally { await database.close(); }
});
