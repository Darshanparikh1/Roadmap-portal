import { ApiError, asyncHandler } from "../utils/api-error.js";
import { Post, ROADMAP_STATUSES, STATUSES } from "../models/post.model.js";
import { Comment } from "../models/comment.model.js";
import { User } from "../models/user.model.js";
import { withSearch } from "../services/search.js";

/** Public 3-column Kanban roadmap. Anything still under review stays out of it. */
export const getRoadmap = asyncHandler(async (req, res) => {
  const columns = await Promise.all(
    ROADMAP_STATUSES.map(async (status) => {
      const [items, total] = await Promise.all([
        Post.find({ status })
          .sort({ boardOrder: 1, voteCount: -1, _id: -1 })
          .limit(50)
          .populate("author", "name role"),
        Post.countDocuments({ status }),
      ]);
      return { status, total, items: items.map((p) => p.toFeedJSON(req.user?._id)) };
    }),
  );
  res.json({ columns });
});

export const adminListPosts = asyncHandler(async (req, res) => {
  const { status, category, q, page, limit, sort } = req.validatedQuery;
  const base = {};
  if (status) base.status = status;
  if (category) base.category = category;

  const sortMap = {
    trending: { trendingScore: -1 },
    top: { voteCount: -1 },
    newest: { createdAt: -1 },
    discussed: { commentCount: -1 },
  };

  const { items, total, counts } = await withSearch(q, base, async (filter) => {
    const [docs, count, grouped] = await Promise.all([
      Post.find(filter)
        .sort(sortMap[sort])
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("author", "name role"),
      Post.countDocuments(filter),
      Post.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
    ]);
    const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0]));
    let all = 0;
    for (const row of grouped) {
      byStatus[row._id] = row.n;
      all += row.n;
    }
    return { items: docs, total: count, counts: { all, ...byStatus } };
  });

  res.json({ items: items.map((p) => p.toFeedJSON(req.user?._id)), page, limit, total, hasMore: page * limit < total, counts });
});

/** RBAC-guarded status transition, with an audit trail on the post. */
export const updateStatus = asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.id).populate("author", "name role");
  if (!post) throw ApiError.notFound("Feature request not found");

  const { status } = req.body;
  if (status === post.status) return res.json(post.toFeedJSON(req.user._id));

  post.statusHistory.push({ from: post.status, to: status, at: new Date(), by: req.user._id });
  post.status = status;
  post.lastActivityAt = new Date();
  // New arrivals go to the top of their column.
  if (ROADMAP_STATUSES.includes(status)) {
    const first = await Post.findOne({ status }).sort({ boardOrder: 1 }).select("boardOrder");
    post.boardOrder = (first?.boardOrder ?? 0) - 1;
  }
  await post.save();

  res.json(post.toFeedJSON(req.user._id));
});

/** Persists a column's order after a drag-and-drop on the board. */
export const reorderColumn = asyncHandler(async (req, res) => {
  const { status, orderedIds } = req.body;
  await Promise.all(
    orderedIds.map((id, index) => Post.updateOne({ _id: id, status }, { $set: { boardOrder: index } })),
  );
  res.json({ status, ordered: orderedIds.length });
});

export const adminStats = asyncHandler(async (_req, res) => {
  const [byStatus, byCategory, users, comments, topRequests] = await Promise.all([
    Post.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
    Post.aggregate([{ $group: { _id: "$category", n: { $sum: 1 } } }]),
    User.countDocuments(),
    Comment.countDocuments({ isDeleted: false }),
    Post.find().sort({ voteCount: -1 }).limit(5).select("title slug voteCount status"),
  ]);
  res.json({
    posts: Object.fromEntries(byStatus.map((r) => [r._id, r.n])),
    categories: Object.fromEntries(byCategory.map((r) => [r._id, r.n])),
    users,
    comments,
    topRequests: topRequests.map((p) => ({
      id: String(p._id),
      title: p.title,
      slug: p.slug,
      voteCount: p.voteCount,
      status: p.status,
    })),
  });
});
