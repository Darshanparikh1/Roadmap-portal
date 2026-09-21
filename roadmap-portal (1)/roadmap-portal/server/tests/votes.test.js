import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { agent, createPost, setupDb, signedInUser, teardownDb } from "./helpers.js";
import { Post } from "../src/models/post.model.js";

beforeAll(() => setupDb("votes"));
afterAll(teardownDb);

describe("atomic upvoting", () => {
  it("counts one vote per person and toggles off on a second click", async () => {
    const { client: author } = await signedInUser("vauthor@test.dev");
    const { client: voter, user } = await signedInUser("voter@test.dev");
    const post = await createPost(author, { title: "Vote on this request" });

    const on = await voter.post(`/api/v1/posts/${post.id}/vote`).expect(200);
    expect(on.body).toMatchObject({ voteCount: 2, hasVoted: true });

    const off = await voter.post(`/api/v1/posts/${post.id}/vote`).expect(200);
    expect(off.body).toMatchObject({ voteCount: 1, hasVoted: false });

    const stored = await Post.findById(post.id);
    expect(stored.voters.map(String)).not.toContain(user.id);
    expect(stored.voteCount).toBe(1);
  });

  it("cannot be double-counted by concurrent requests", async () => {
    const { client: author } = await signedInUser("racer-author@test.dev");
    const { client: voter } = await signedInUser("racer@test.dev");
    const post = await createPost(author, { title: "Race this vote endpoint" });

    // Ten simultaneous clicks: each one either adds or removes, never double-adds.
    await Promise.all(Array.from({ length: 10 }, () => voter.post(`/api/v1/posts/${post.id}/vote`)));

    const stored = await Post.findById(post.id);
    expect(stored.voters.filter((v) => String(v) !== String(stored.author)).length).toBeLessThanOrEqual(1);
    expect(stored.voteCount).toBe(stored.voters.length); // counter never drifts from the voter list
  });

  it("asks anonymous visitors to sign in", async () => {
    const { client: author } = await signedInUser("anonvote@test.dev");
    const post = await createPost(author, { title: "Anonymous cannot vote here" });
    const res = await agent().post(`/api/v1/posts/${post.id}/vote`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("not_authenticated");
  });

  it("reports the viewer's own vote state in the feed", async () => {
    const { client: author } = await signedInUser("state-author@test.dev");
    const { client: voter } = await signedInUser("state-voter@test.dev");
    const post = await createPost(author, { title: "Shows my vote state" });
    await voter.post(`/api/v1/posts/${post.id}/vote`).expect(200);

    const mine = await voter.get(`/api/v1/posts/${post.slug}`).expect(200);
    expect(mine.body.hasVoted).toBe(true);
    const theirs = await agent().get(`/api/v1/posts/${post.slug}`).expect(200);
    expect(theirs.body.hasVoted).toBe(false);
  });
});
