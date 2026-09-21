import { ApiError, asyncHandler } from "../utils/api-error.js";
import { Post } from "../models/post.model.js";
import { Comment, MAX_COMMENT_DEPTH, buildCommentTree } from "../models/comment.model.js";
import { uniqueSlug, withSearch } from "../services/search.js";
import { trendingScore } from "../utils/ranking.js";

const SORTS = {
  trending: { trendingScore: -1, _id: -1 },
  top: { voteCount: -1, createdAt: -1, _id: -1 },
  newest: { createdAt: -1, _id: -1 },
  discussed: { commentCount: -1, createdAt: -1, _id: -1 },
};

export const listPosts = asyncHandler(async (req, res) => {
  const { sort, category, status, q, page, limit } = req.validatedQuery;

  const base = {};
  if (category) base.category = category;
  if (status) base.status = status;

  const { items, total } = await withSearch(q, base, async (filter) => {
    const [docs, count] = await Promise.all([
      Post.find(filter)
        .sort(SORTS[sort])
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("author", "name role"),
      Post.countDocuments(filter),
    ]);
    return { items: docs, total: count };
  });

  res.json({
    items: items.map((p) => p.toFeedJSON(req.user?._id)),
    page,
    limit,
    total,
    hasMore: page * limit < total,
  });
});

export const getPost = asyncHandler(async (req, res) => {
  const post = await Post.findOne({ slug: req.params.slug }).populate("author", "name role");
  if (!post) throw ApiError.notFound("Feature request not found");
  res.json(post.toFeedJSON(req.user?._id));
});

export const createPost = asyncHandler(async (req, res) => {
  const { title, description, category } = req.body;
  const post = await Post.create({
    title,
    description,
    category,
    slug: await uniqueSlug(title),
    author: req.user._id,
    // The author's own vote: nobody submits an idea they disagree with.
    voters: [req.user._id],
    voteCount: 1,
    trendingScore: trendingScore({ voteCount: 1, commentCount: 0, createdAt: new Date() }),
  });
  await post.populate("author", "name role");
  res.status(201).json(post.toFeedJSON(req.user._id));
});

export const updatePost = asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.id).populate("author", "name role");
  if (!post) throw ApiError.notFound("Feature request not found");

  const isAuthor = String(post.author._id) === String(req.user._id);
  if (!isAuthor && req.user.role !== "admin") throw ApiError.forbidden("Only the author can edit this request");

  Object.assign(post, req.body);
  post.lastActivityAt = new Date();
  await post.save();
  res.json(post.toFeedJSON(req.user._id));
});

export const deletePost = asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) throw ApiError.notFound("Feature request not found");

  const isAuthor = String(post.author) === String(req.user._id);
  if (!isAuthor && req.user.role !== "admin") throw ApiError.forbidden("Only the author can delete this request");

  await Comment.deleteMany({ post: post._id });
  await post.deleteOne();
  res.status(204).end();
});

/**
 * Toggle a vote.
 *
 * Both directions are a single atomic findOneAndUpdate whose filter carries the guard:
 * "$ne: me" for adding, "$eq: me" for removing. Two clicks racing each other can't produce a
 * double count, because the second one no longer matches the filter. No read-then-write,
 * no transaction.
 */
export const toggleVote = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const id = req.params.id;

  let post = await Post.findOneAndUpdate(
    { _id: id, voters: { $ne: userId } },
    { $addToSet: { voters: userId }, $inc: { voteCount: 1 }, $set: { lastActivityAt: new Date() } },
    { new: true },
  );
  let voted = true;

  if (!post) {
    post = await Post.findOneAndUpdate(
      { _id: id, voters: userId },
      { $pull: { voters: userId }, $inc: { voteCount: -1 }, $set: { lastActivityAt: new Date() } },
      { new: true },
    );
    voted = false;
  }

  if (!post) throw ApiError.notFound("Feature request not found");

  // Trending depends on the new count, so it's recomputed right after the atomic update.
  post.trendingScore = trendingScore(post);
  await post.save();

  res.json({ id: String(post._id), voteCount: post.voteCount, hasVoted: voted });
});

export const listComments = asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.id).select("_id");
  if (!post) throw ApiError.notFound("Feature request not found");

  const comments = await Comment.find({ post: post._id }).sort({ createdAt: 1 }).populate("author", "name role");
  res.json({ items: buildCommentTree(comments, req.user), total: comments.length });
});

export const createComment = asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) throw ApiError.notFound("Feature request not found");

  let depth = 0;
  let parent = null;
  if (req.body.parentId) {
    parent = await Comment.findOne({ _id: req.body.parentId, post: post._id });
    if (!parent) throw ApiError.badRequest("The comment you're replying to no longer exists");
    if (parent.isDeleted) throw ApiError.badRequest("You can't reply to a deleted comment");
    // Deeper replies collapse onto the last allowed level instead of being refused.
    depth = Math.min(parent.depth + 1, MAX_COMMENT_DEPTH);
  }

  const comment = await Comment.create({
    post: post._id,
    author: req.user._id,
    parent: parent?._id ?? null,
    depth,
    body: req.body.body,
  });
  await comment.populate("author", "name role");

  const updated = await Post.findByIdAndUpdate(
    post._id,
    { $inc: { commentCount: 1 }, $set: { lastActivityAt: new Date() } },
    { new: true },
  );
  updated.trendingScore = trendingScore(updated);
  await updated.save();

  res.status(201).json(comment.toJSONFor(req.user));
});

export const updateComment = asyncHandler(async (req, res) => {
  const comment = await Comment.findById(req.params.id).populate("author", "name role");
  if (!comment || comment.isDeleted) throw ApiError.notFound("Comment not found");
  // Editing is the author's alone: an admin rewriting someone's words would be worse than deleting them.
  if (String(comment.author._id) !== String(req.user._id)) throw ApiError.forbidden("Only the author can edit a comment");

  comment.body = req.body.body;
  comment.editedAt = new Date();
  await comment.save();
  res.json(comment.toJSONFor(req.user));
});

export const deleteComment = asyncHandler(async (req, res) => {
  const comment = await Comment.findById(req.params.id);
  if (!comment || comment.isDeleted) throw ApiError.notFound("Comment not found");

  const isAuthor = String(comment.author) === String(req.user._id);
  if (!isAuthor && req.user.role !== "admin") throw ApiError.forbidden("You can't delete this comment");

  const hasReplies = await Comment.exists({ parent: comment._id, isDeleted: false });
  if (hasReplies) {
    // Keep a tombstone so the replies underneath don't lose their place in the thread.
    comment.isDeleted = true;
    comment.body = "";
    await comment.save();
  } else {
    await comment.deleteOne();
  }

  const post = await Post.findByIdAndUpdate(comment.post, { $inc: { commentCount: -1 } }, { new: true });
  if (post) {
    post.commentCount = Math.max(0, post.commentCount);
    post.trendingScore = trendingScore(post);
    await post.save();
  }

  res.status(204).end();
});
