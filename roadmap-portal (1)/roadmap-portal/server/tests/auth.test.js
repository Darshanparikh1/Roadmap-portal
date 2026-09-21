import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { env } from "../src/config/env.js";
import { agent, mailFor, registerUser, setupDb, teardownDb, tokenFromMail } from "./helpers.js";

const refreshCookie = (client) =>
  client.jar.getCookie("refresh_token", { path: "/api/v1/auth", domain: "127.0.0.1", secure: false, script: false })
    .value;

beforeAll(() => setupDb("auth"));
afterAll(teardownDb);

describe("signup and verification", () => {
  it("refuses login until the email is verified, and the link works once", async () => {
    const client = agent();
    await client.post("/api/v1/auth/signup").send({ name: "Ada", email: "ada@test.dev", password: "Passw0rd1" }).expect(201);

    const blocked = await client.post("/api/v1/auth/login").send({ email: "ada@test.dev", password: "Passw0rd1" });
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe("email_not_verified");

    const [mail] = await mailFor(client, "ada@test.dev");
    const token = tokenFromMail(mail);
    await client.post("/api/v1/auth/verify-email").send({ token }).expect(200);
    // Single use.
    await client.post("/api/v1/auth/verify-email").send({ token }).expect(400);
    await client.post("/api/v1/auth/login").send({ email: "ada@test.dev", password: "Passw0rd1" }).expect(200);
  });

  it("rejects weak passwords and duplicate emails", async () => {
    const client = agent();
    const weak = await client.post("/api/v1/auth/signup").send({ name: "X", email: "weak@test.dev", password: "password" });
    expect(weak.status).toBe(422);
    expect(weak.body.error.details.password).toMatch(/letter and one number/);

    await registerUser(client, { email: "dup@test.dev" });
    const again = await client.post("/api/v1/auth/signup").send({ name: "X", email: "DUP@test.dev", password: "Passw0rd1" });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe("email_taken");
  });
});

describe("sessions", () => {
  it("sets httpOnly access and refresh cookies scoped correctly", async () => {
    const client = agent();
    await registerUser(client, { email: "cookies@test.dev" });
    const res = await client.post("/api/v1/auth/login").send({ email: "cookies@test.dev", password: "Passw0rd1" }).expect(200);

    const cookies = res.headers["set-cookie"].join("\n");
    expect(cookies).toMatch(/access_token=[^;]+;.*HttpOnly/i);
    expect(cookies).toMatch(/refresh_token=[^;]+;.*Path=\/api\/v1\/auth/i);
    expect(cookies).toMatch(/session_hint=1/); // readable by the SPA, holds no secret
    expect(cookies.split("\n").find((c) => c.startsWith("session_hint"))).not.toMatch(/HttpOnly/i);

    const me = await client.get("/api/v1/auth/me").expect(200);
    expect(me.body.email).toBe("cookies@test.dev");
  });

  it("rotates the pair on every refresh", async () => {
    const client = agent();
    await registerUser(client, { email: "rotate@test.dev" });
    await client.post("/api/v1/auth/login").send({ email: "rotate@test.dev", password: "Passw0rd1" }).expect(200);

    const first = refreshCookie(client);
    await client.post("/api/v1/auth/refresh").expect(200);
    expect(refreshCookie(client)).not.toBe(first);
    await client.get("/api/v1/auth/me").expect(200);
  });

  it("treats a replayed token as theft and revokes the whole family", async () => {
    const grace = env.REFRESH_REUSE_GRACE_SECONDS;
    env.REFRESH_REUSE_GRACE_SECONDS = 0; // no race window for this test
    try {
      const client = agent();
      await registerUser(client, { email: "replay@test.dev" });
      await client.post("/api/v1/auth/login").send({ email: "replay@test.dev", password: "Passw0rd1" }).expect(200);

      const stolen = refreshCookie(client);
      await client.post("/api/v1/auth/refresh").expect(200); // rotates `stolen` away
      const live = refreshCookie(client);

      const attacker = agent();
      const replayed = await attacker.post("/api/v1/auth/refresh").set("Cookie", `refresh_token=${stolen}`);
      expect(replayed.status).toBe(401);
      expect(replayed.body.error.code).toBe("refresh_reuse_detected");

      // The legitimate newer token is revoked too: the whole login is burned.
      const victim = agent();
      const after = await victim.post("/api/v1/auth/refresh").set("Cookie", `refresh_token=${live}`);
      expect(after.status).toBe(401);
    } finally {
      env.REFRESH_REUSE_GRACE_SECONDS = grace;
    }
  });

  it("allows two tabs to refresh at the same moment (race, not theft)", async () => {
    const client = agent();
    await registerUser(client, { email: "tabs@test.dev" });
    await client.post("/api/v1/auth/login").send({ email: "tabs@test.dev", password: "Passw0rd1" }).expect(200);

    const shared = refreshCookie(client);
    const tabA = await agent().post("/api/v1/auth/refresh").set("Cookie", `refresh_token=${shared}`);
    const tabB = await agent().post("/api/v1/auth/refresh").set("Cookie", `refresh_token=${shared}`);
    expect(tabA.status).toBe(200);
    expect(tabB.status).toBe(200); // inside REFRESH_REUSE_GRACE_SECONDS
  });

  it("logs out and refuses to refresh afterwards", async () => {
    const client = agent();
    await registerUser(client, { email: "logout@test.dev" });
    await client.post("/api/v1/auth/login").send({ email: "logout@test.dev", password: "Passw0rd1" }).expect(200);
    await client.post("/api/v1/auth/logout").expect(204);
    await client.post("/api/v1/auth/refresh").expect(401);
    await client.get("/api/v1/auth/me").expect(401);
  });
});

describe("password reset", () => {
  it("answers identically for unknown emails, then resets and kills old sessions", async () => {
    const client = agent();
    await registerUser(client, { email: "reset@test.dev" });
    await client.post("/api/v1/auth/login").send({ email: "reset@test.dev", password: "Passw0rd1" }).expect(200);

    const unknown = await client.post("/api/v1/auth/forgot-password").send({ email: "ghost@test.dev" }).expect(200);
    const known = await client.post("/api/v1/auth/forgot-password").send({ email: "reset@test.dev" }).expect(200);
    expect(unknown.body).toEqual(known.body);

    const mails = await mailFor(client, "reset@test.dev");
    const token = tokenFromMail(mails.find((m) => m.subject.includes("Reset")));

    await client.post("/api/v1/auth/reset-password").send({ token, password: "BrandNew99" }).expect(200);
    // Single use, old sessions gone, old password dead.
    await client.post("/api/v1/auth/reset-password").send({ token, password: "Another123" }).expect(400);
    await client.post("/api/v1/auth/refresh").expect(401);
    await client.post("/api/v1/auth/login").send({ email: "reset@test.dev", password: "Passw0rd1" }).expect(401);
    await client.post("/api/v1/auth/login").send({ email: "reset@test.dev", password: "BrandNew99" }).expect(200);
  });

  it("invalidates an earlier reset link when a new one is requested", async () => {
    const client = agent();
    await registerUser(client, { email: "twolinks@test.dev" });
    await client.post("/api/v1/auth/forgot-password").send({ email: "twolinks@test.dev" }).expect(200);
    const first = tokenFromMail((await mailFor(client, "twolinks@test.dev"))[0]);
    await client.post("/api/v1/auth/forgot-password").send({ email: "twolinks@test.dev" }).expect(200);

    await client.post("/api/v1/auth/reset-password").send({ token: first, password: "BrandNew99" }).expect(400);
  });
});
