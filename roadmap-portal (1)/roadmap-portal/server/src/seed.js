import mongoose from "mongoose";
import { env } from "./config/env.js";
import { connectDb, disconnectDb } from "./db/connect.js";
import { User } from "./models/user.model.js";
import { Post } from "./models/post.model.js";
import { Comment } from "./models/comment.model.js";
import { trendingScore } from "./utils/ranking.js";
import { uniqueSlug } from "./services/search.js";
import { PEOPLE, REQUESTS, DEMO_PASSWORD } from "./seed-data.js";

const DAY = 86_400_000;

/** Creates the first admin from ADMIN_EMAIL / ADMIN_PASSWORD if it doesn't exist yet. */
export async function ensureAdmin() {
  const existing = await User.findOne({ email: env.ADMIN_EMAIL.toLowerCase() });
  if (existing) return existing;
  const admin = new User({ name: env.ADMIN_NAME, email: env.ADMIN_EMAIL, role: "admin", isVerified: true });
  await admin.setPassword(env.ADMIN_PASSWORD);
  await admin.save();
  console.log(`Created admin account ${admin.email}`);
  return admin;
}

/** Creates the demo accounts once and returns them keyed by handle. */
async function ensurePeople() {
  const byKey = new Map();
  for (const person of PEOPLE) {
    let user = await User.findOne({ email: person.email });
    if (!user) {
      user = new User({
        name: person.name,
        email: person.email,
        role: person.role ?? "user",
        isVerified: true,
      });
      await user.setPassword(DEMO_PASSWORD);
      await user.save();
    }
    byKey.set(person.key, user);
  }
  return byKey;
}

/**
 * Walks the status changes in order so `from` is always the status the request was actually
 * in beforehand — an audit trail that reads the way a real one would.
 */
function buildStatusHistory(item, createdAt, adminId) {
  let current = "under_review";
  const history = [];
  for (const change of item.track ?? []) {
    history.push({ from: current, to: change.to, at: new Date(createdAt.getTime() + change.after * DAY), by: adminId });
    current = change.to;
  }
  if (current !== item.status) {
    throw new Error(`"${item.title}": the status track ends at "${current}" but the request says "${item.status}".`);
  }
  return history;
}

/** Inserts a comment and its replies, returning how many documents were written. */
async function insertThread(postId, createdAt, people, comment, parent = null, depth = 0) {
  const at = new Date(createdAt.getTime() + comment.after * DAY);
  const author = people.get(comment.by);
  if (!author) throw new Error(`Unknown comment author "${comment.by}".`);

  const doc = await Comment.create({
    post: postId,
    author: author._id,
    parent: parent?._id ?? null,
    depth,
    body: comment.body,
    createdAt: at,
    updatedAt: at,
  });

  let count = 1;
  let lastAt = at;
  for (const reply of comment.replies ?? []) {
    const nested = await insertThread(postId, createdAt, people, reply, doc, depth + 1);
    count += nested.count;
    if (nested.lastAt > lastAt) lastAt = nested.lastAt;
  }
  return { count, lastAt };
}

async function run() {
  const reset = process.argv.includes("--reset");
  await connectDb();
  console.log(`Seeding ${mongoose.connection.name} on ${mongoose.connection.host}:${mongoose.connection.port}`);

  if (reset) {
    await Promise.all([Post.deleteMany({}), Comment.deleteMany({})]);
    console.log("Cleared posts and comments.");
  }

  const admin = await ensureAdmin();
  const people = await ensurePeople();
  people.set("admin", admin);

  if (await Post.exists({})) {
    console.log("Posts already exist — run `npm run seed:reset` to replace them.");
    await disconnectDb();
    return;
  }

  // Board order runs newest-first inside each status column, which is what an admin who has
  // never reordered anything by hand would see.
  const orderWithinStatus = new Map();
  let posts = 0;
  let comments = 0;

  for (const item of REQUESTS) {
    const author = people.get(item.author);
    if (!author) throw new Error(`Unknown author "${item.author}" on "${item.title}".`);

    const createdAt = new Date(Date.now() - item.days * DAY);
    const statusHistory = buildStatusHistory(item, createdAt, admin._id);

    // Votes are the people listed, de-duplicated, with the author's own vote guaranteed first.
    const voterKeys = [...new Set([item.author, ...item.voters])];
    const voters = voterKeys.map((key) => {
      const voter = people.get(key);
      if (!voter) throw new Error(`Unknown voter "${key}" on "${item.title}".`);
      return voter._id;
    });

    const boardOrder = orderWithinStatus.get(item.status) ?? 0;
    orderWithinStatus.set(item.status, boardOrder + 1);

    const post = await Post.create({
      title: item.title,
      slug: await uniqueSlug(item.title),
      description: item.description,
      category: item.category,
      status: item.status,
      author: author._id,
      voters,
      voteCount: voters.length,
      boardOrder,
      createdAt,
      updatedAt: statusHistory.at(-1)?.at ?? createdAt,
      lastActivityAt: createdAt,
      statusHistory,
    });

    let lastActivityAt = statusHistory.at(-1)?.at ?? createdAt;
    let commentCount = 0;
    for (const comment of item.comments ?? []) {
      const thread = await insertThread(post._id, createdAt, people, comment);
      commentCount += thread.count;
      if (thread.lastAt > lastActivityAt) lastActivityAt = thread.lastAt;
    }

    // Both counters come from what was actually written, and the score from both counters.
    // Written with `timestamps: false` so this bookkeeping pass doesn't stamp every request
    // as edited today — `updatedAt` stays on the last change that really happened to it.
    post.commentCount = commentCount;
    post.lastActivityAt = lastActivityAt;
    await Post.updateOne(
      { _id: post._id },
      {
        $set: {
          commentCount,
          lastActivityAt,
          trendingScore: trendingScore(post),
          updatedAt: statusHistory.at(-1)?.at ?? createdAt,
        },
      },
      { timestamps: false },
    );

    posts += 1;
    comments += commentCount;
  }

  const votes = await Post.aggregate([{ $group: { _id: null, total: { $sum: "$voteCount" } } }]);

  console.log(
    `Seeded ${posts} feature requests, ${comments} comments, ${votes[0]?.total ?? 0} votes ` +
      `across ${people.size} accounts.`,
  );
  console.log(`Admin:  ${env.ADMIN_EMAIL} / ${env.ADMIN_PASSWORD}`);
  console.log(`Member: ${PEOPLE[1].email} / ${DEMO_PASSWORD}`);
  await disconnectDb();
}

// Only run when executed directly (`npm run seed`), not when imported by the server.
if (process.argv[1] && process.argv[1].endsWith("seed.js")) {
  run().catch(async (err) => {
    console.error(err);
    await mongoose.disconnect();
    process.exit(1);
  });
}
