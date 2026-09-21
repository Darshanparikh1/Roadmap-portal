import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { agent, createPost, setupDb, signedInAdmin, signedInUser, teardownDb } from "./helpers.js";

beforeAll(() => setupDb("posts"));
afterAll(teardownDb);

describe("feature request submission", () => {
  it("requires a verified session and validates the form", async () => {
    const anon = agent();
    await anon.post("/api/v1/posts").send({ title: "Anonymous idea", description: "Long enough description" }).expect(401);

    const { client } = await signedInUser("author@test.dev");
    const short = await client.post("/api/v1/posts").send({ title: "hi", description: "too short" });
    expect(short.status).toBe(422);
    expect(short.body.error.details.title).toMatch(/at least 5/);

    const post = await createPost(client, { title: "Dark mode for the dashboard", category: "ui_ux" });
    expect(post.slug).toBe("dark-mode-for-the-dashboard");
    expect(post.status).toBe("under_review");
    // The author's own vote is counted on submission.
    expect(post.voteCount).toBe(1);
    expect(post.hasVoted).toBe(true);
    expect(post.author.name).toBe("Test Person");
  });

  it("gives duplicate titles distinct slugs", async () => {
    const { client } = await signedInUser("slugs@test.dev");
    const a = await createPost(client, { title: "Export to CSV" });
    const b = await createPost(client, { title: "Export to CSV" });
    expect(a.slug).toBe("export-to-csv");
    expect(b.slug).toBe("export-to-csv-2");
  });

  it("lets the author edit and delete, but not other members", async () => {
    const { client: owner } = await signedInUser("owner@test.dev");
    const { client: stranger } = await signedInUser("stranger@test.dev");
    const post = await createPost(owner, { title: "Editable request here" });

    const denied = await stranger.patch(`/api/v1/posts/${post.id}`).send({ title: "Hijacked title here" });
    expect(denied.status).toBe(403);

    const edited = await owner.patch(`/api/v1/posts/${post.id}`).send({ category: "performance" }).expect(200);
    expect(edited.body.category).toBe("performance");

    await stranger.delete(`/api/v1/posts/${post.id}`).expect(403);
    await owner.delete(`/api/v1/posts/${post.id}`).expect(204);
    await owner.get(`/api/v1/posts/${post.slug}`).expect(404);
  });
});

describe("feed", () => {
  it("sorts, filters, searches and paginates", async () => {
    const { client } = await signedInUser("feed@test.dev");
    await createPost(client, { title: "Slack integration please", category: "integrations", description: "Post to a channel when something ships." });
    await createPost(client, { title: "Board is slow with 500 cards", category: "performance", description: "Rendering takes six seconds." });
    await createPost(client, { title: "Keyboard shortcuts for triage", category: "ui_ux", description: "J and K to move between cards." });

    const anon = agent();
    const newest = await anon.get("/api/v1/posts").query({ sort: "newest", limit: 50 }).expect(200);
    const dates = newest.body.items.map((p) => p.createdAt);
    expect([...dates].sort().reverse()).toEqual(dates);
    expect(newest.body.items[0].hasVoted).toBe(false); // anonymous viewers never look voted-in

    const byCategory = await anon.get("/api/v1/posts").query({ category: "performance", limit: 50 }).expect(200);
    expect(byCategory.body.items.every((p) => p.category === "performance")).toBe(true);

    const search = await anon.get("/api/v1/posts").query({ q: "slack", limit: 50 }).expect(200);
    expect(search.body.items.map((p) => p.title)).toContain("Slack integration please");

    const bodyMatch = await anon.get("/api/v1/posts").query({ q: "channel", limit: 50 }).expect(200);
    expect(bodyMatch.body.total).toBeGreaterThan(0); // searches descriptions too

    const miss = await anon.get("/api/v1/posts").query({ q: "nothingmatchesthis", limit: 50 }).expect(200);
    expect(miss.body.total).toBe(0);

    const page = await anon.get("/api/v1/posts").query({ limit: 2, page: 1 }).expect(200);
    expect(page.body.items).toHaveLength(2);
    expect(page.body.hasMore).toBe(true);
  });

  it("ranks trending by engagement and recency", async () => {
    const { client } = await signedInUser("trend@test.dev");
    const fresh = await createPost(client, { title: "Brand new idea with votes" });
    const { client: voter1 } = await signedInUser("trendvoter1@test.dev");
    const { client: voter2 } = await signedInUser("trendvoter2@test.dev");
    await voter1.post(`/api/v1/posts/${fresh.id}/vote`).expect(200);
    await voter2.post(`/api/v1/posts/${fresh.id}/vote`).expect(200);

    const trending = await agent().get("/api/v1/posts").query({ sort: "trending", limit: 5 }).expect(200);
    expect(trending.body.items[0].id).toBe(fresh.id);
  });
});

describe("roadmap and admin controls", () => {
  it("keeps status changes to admins and publishes them on the board", async () => {
    const { client: member } = await signedInUser("member@test.dev");
    const { client: admin } = await signedInAdmin();
    const post = await createPost(member, { title: "Should reach the roadmap" });

    await member.patch(`/api/v1/admin/posts/${post.id}/status`).send({ status: "planned" }).expect(403);
    await member.get("/api/v1/admin/posts").expect(403);

    const moved = await admin.patch(`/api/v1/admin/posts/${post.id}/status`).send({ status: "planned" }).expect(200);
    expect(moved.body.status).toBe("planned");
    expect(moved.body.statusHistory.at(-1)).toMatchObject({ from: "under_review", to: "planned" });

    const board = await agent().get("/api/v1/roadmap").expect(200);
    const columns = Object.fromEntries(board.body.columns.map((c) => [c.status, c.items.map((i) => i.id)]));
    expect(Object.keys(columns)).toEqual(["planned", "in_progress", "completed"]);
    expect(columns.planned).toContain(post.id);

    // Under-review requests never appear on the public board.
    const underReview = await createPost(member, { title: "Still under review here" });
    const board2 = await agent().get("/api/v1/roadmap").expect(200);
    expect(board2.body.columns.flatMap((c) => c.items.map((i) => i.id))).not.toContain(underReview.id);

    const rejected = await admin.patch(`/api/v1/admin/posts/${post.id}/status`).send({ status: "shipped" });
    expect(rejected.status).toBe(422);
  });

  it("reorders a roadmap column", async () => {
    const { client: member } = await signedInUser("orderer@test.dev");
    const { client: admin } = await signedInAdmin();
    const a = await createPost(member, { title: "First card on the board" });
    const b = await createPost(member, { title: "Second card on the board" });
    for (const p of [a, b]) await admin.patch(`/api/v1/admin/posts/${p.id}/status`).send({ status: "in_progress" }).expect(200);

    await admin.patch("/api/v1/admin/roadmap/order").send({ status: "in_progress", orderedIds: [b.id, a.id] }).expect(200);
    const board = await agent().get("/api/v1/roadmap").expect(200);
    const column = board.body.columns.find((c) => c.status === "in_progress").items.map((i) => i.id);
    expect(column.indexOf(b.id)).toBeLessThan(column.indexOf(a.id));
  });

  it("reports stats for the admin dashboard", async () => {
    const { client: admin } = await signedInAdmin();
    const stats = await admin.get("/api/v1/admin/stats").expect(200);
    expect(stats.body.users).toBeGreaterThan(0);
    expect(stats.body.topRequests.length).toBeGreaterThan(0);
  });
});
