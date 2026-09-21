import mongoose from "mongoose";
import request from "supertest";
import { createApp } from "../src/app.js";
import { connectDb, disconnectDb } from "../src/db/connect.js";
import { env } from "../src/config/env.js";
import { ensureAdmin } from "../src/seed.js";

const BASE_URI = env.MONGODB_TEST_URI;

export async function setupDb(name) {
  await connectDb(`${BASE_URI}/test_${name}`);
  await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
  await ensureAdmin();
}

export async function teardownDb() {
  await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
  await disconnectDb();
}

export const app = () => createApp();

/** A supertest agent keeps cookies between requests, like a browser would. */
export const agent = () => request.agent(createApp());

export async function mailFor(client, email) {
  const res = await client.get("/api/v1/dev/mailbox").query({ email });
  return res.body;
}

export function tokenFromMail(mail) {
  return new URL(mail.actionUrl).searchParams.get("token");
}

export async function registerUser(client, { email, name = "Test Person", password = "Passw0rd1" } = {}) {
  await client.post("/api/v1/auth/signup").send({ name, email, password }).expect(201);
  const [mail] = await mailFor(client, email);
  await client.post("/api/v1/auth/verify-email").send({ token: tokenFromMail(mail) }).expect(200);
  return { email, password, name };
}

export async function loginAs(client, email, password = "Passw0rd1") {
  const res = await client.post("/api/v1/auth/login").send({ email, password }).expect(200);
  return res.body.user;
}

/** Signed-up, verified and signed in, on its own cookie jar. */
export async function signedInUser(email) {
  const client = agent();
  const creds = await registerUser(client, { email });
  const user = await loginAs(client, creds.email, creds.password);
  return { client, user };
}

export async function signedInAdmin() {
  const client = agent();
  const user = await loginAs(client, "admin@test.dev", "Admin@12345");
  return { client, user };
}

export async function createPost(client, overrides = {}) {
  const res = await client
    .post("/api/v1/posts")
    .send({ title: "A reasonable feature request", description: "Something useful described properly.", category: "general", ...overrides })
    .expect(201);
  return res.body;
}
