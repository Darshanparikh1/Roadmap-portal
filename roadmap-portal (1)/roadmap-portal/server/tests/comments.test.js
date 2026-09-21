import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { agent, createPost, setupDb, signedInAdmin, signedInUser, teardownDb } from "./helpers.js";
import { Post } from "../src/models/post.model.js";

beforeAll(() => setupDb("comments"));
afterAll(teardownDb);

let threadNo = 0;

/** A fresh author + post for each test, so suites never collide on emails. */
async function thread() {
  threadNo += 1;
  const { client: author } = await signedInUser(`cauthor${threadNo}@test.dev`);
  const post = await createPost(author, { title: `Discussion happens here ${threadNo}` });
  return { author, post };
}

describe("threaded discussion", () => {
  it("nests replies and keeps the post's comment count in step", async () => {
    const { author, post } = await thread();
    const { client: other } = await signedInUser("creplier@test.dev");

    const root = await author.post(`/api/v1/posts/${post.id}/comments`).send({ body: "Great idea, **strongly** agree." }).expect(201);
    expect(root.body.depth).toBe(0);

    const reply = await other.post(`/api/v1/posts/${post.id}/comments`).send({ body: "Same here.", parentId: root.body.id }).expect(201);
    expect(reply.body).toMatchObject({ depth: 1, parentId: root.body.id });

    const tree = await author.get(`/api/v1/posts/${post.id}/comments`).expect(200);
    expect(tree.body.total).toBe(2);
    expect(tree.body.items).toHaveLength(1); // one root
    expect(tree.body.items[0].replies[0].id).toBe(reply.body.id);

    expect((await Post.findById(post.id)).commentCount).toBe(2);
  });

  it("keeps the discussion behind a sign-in, but not the comment count", async () => {
    const { author, post } = await thread();
    await author.post(`/api/v1/posts/${post.id}/comments`).send({ body: "Members only." }).expect(201);

    // The words are for members; the fact that a discussion exists is public, because the feed
    // card shows a comment count and the request page invites a signed-out visitor to join it.
    await agent().get(`/api/v1/posts/${post.id}/comments`).expect(401);

    const feed = await agent().get("/api/v1/posts").expect(200);
    expect(feed.body.items.find((p) => p.id === post.id).commentCount).toBe(1);

    const asMember = await author.get(`/api/v1/posts/${post.id}/comments`).expect(200);
    expect(asMember.body.items).toHaveLength(1);
  });

  it("caps nesting depth instead of refusing deep replies", async () => {
    const { author, post } = await thread();
    let parentId = null;
    const depths = [];
    for (let i = 0; i < 6; i += 1) {
      const res = await author.post(`/api/v1/posts/${post.id}/comments`).send({ body: `level ${i}`, parentId }).expect(201);
      depths.push(res.body.depth);
      parentId = res.body.id;
    }
    expect(depths).toEqual([0, 1, 2, 3, 3, 3]);
  });

  it("lets the author edit, and the author or an admin delete", async () => {
    const { author, post } = await thread();
    const { client: other } = await signedInUser("cstranger@test.dev");
    const { client: admin } = await signedInAdmin();

    const mine = await author.post(`/api/v1/posts/${post.id}/comments`).send({ body: "Original wording" }).expect(201);
    await other.patch(`/api/v1/comments/${mine.body.id}`).send({ body: "Not yours" }).expect(403);
    // Even an admin doesn't get to rewrite someone's words.
    await admin.patch(`/api/v1/comments/${mine.body.id}`).send({ body: "Admin rewrite" }).expect(403);

    const edited = await author.patch(`/api/v1/comments/${mine.body.id}`).send({ body: "Clearer wording" }).expect(200);
    expect(edited.body.body).toBe("Clearer wording");
    expect(edited.body.editedAt).toBeTruthy();

    const theirs = await other.post(`/api/v1/posts/${post.id}/comments`).send({ body: "Off-topic spam" }).expect(201);
    await author.delete(`/api/v1/comments/${theirs.body.id}`).expect(403); // post author isn't a moderator
    await admin.delete(`/api/v1/comments/${theirs.body.id}`).expect(204);

    expect((await Post.findById(post.id)).commentCount).toBe(1);
  });

  it("keeps a tombstone when a comment with replies is deleted", async () => {
    const { author, post } = await thread();
    const { client: other } = await signedInUser("ctomb@test.dev");

    const root = await author.post(`/api/v1/posts/${post.id}/comments`).send({ body: "Parent comment" }).expect(201);
    await other.post(`/api/v1/posts/${post.id}/comments`).send({ body: "Child comment", parentId: root.body.id }).expect(201);

    await author.delete(`/api/v1/comments/${root.body.id}`).expect(204);

    const tree = await author.get(`/api/v1/posts/${post.id}/comments`).expect(200);
    expect(tree.body.items[0]).toMatchObject({ isDeleted: true, body: null, author: null });
    expect(tree.body.items[0].replies).toHaveLength(1); // the reply survives
  });

  it("marks what the viewer is allowed to do", async () => {
    const { author, post } = await thread();
    const { client: other } = await signedInUser("cperms@test.dev");
    const mine = await author.post(`/api/v1/posts/${post.id}/comments`).send({ body: "Permission check" }).expect(201);

    const asAuthor = await author.get(`/api/v1/posts/${post.id}/comments`).expect(200);
    expect(asAuthor.body.items.find((c) => c.id === mine.body.id)).toMatchObject({ canEdit: true, canDelete: true });

    const asOther = await other.get(`/api/v1/posts/${post.id}/comments`).expect(200);
    expect(asOther.body.items.find((c) => c.id === mine.body.id)).toMatchObject({ canEdit: false, canDelete: false });

    // A signed-out viewer doesn't get a list to have flags on — see the test above.
    await agent().get(`/api/v1/posts/${post.id}/comments`).expect(401);
  });
});
