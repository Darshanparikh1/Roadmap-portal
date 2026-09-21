import mongoose from "mongoose";
import { trendingScore } from "../utils/ranking.js";
import { authorJSON } from "./user.model.js";

export const CATEGORIES = ["ui_ux", "integrations", "performance", "general"];
export const STATUSES = ["under_review", "planned", "in_progress", "completed"];
export const ROADMAP_STATUSES = ["planned", "in_progress", "completed"];

const postSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 140 },
    slug: { type: String, required: true, unique: true, index: true },
    description: { type: String, required: true, maxlength: 10_000 }, // markdown
    category: { type: String, enum: CATEGORIES, default: "general", index: true },
    status: { type: String, enum: STATUSES, default: "under_review", index: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    // Denormalized counters, kept correct with atomic $inc rather than recounted on read.
    voters: { type: [mongoose.Schema.Types.ObjectId], ref: "User", default: [], index: true },
    voteCount: { type: Number, default: 0, index: true },
    commentCount: { type: Number, default: 0 },
    trendingScore: { type: Number, default: 0, index: true },

    // Admin trail for status transitions.
    statusHistory: {
      type: [
        {
          _id: false,
          from: { type: String, enum: STATUSES },
          to: { type: String, enum: STATUSES },
          at: { type: Date, default: Date.now },
          by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        },
      ],
      default: [],
    },
    // Manual ordering inside a roadmap column.
    boardOrder: { type: Number, default: 0 },
    lastActivityAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true },
);

// Feed queries: filter by category/status, sort by one of the ranking fields.
postSchema.index({ status: 1, category: 1, trendingScore: -1 });
postSchema.index({ status: 1, category: 1, createdAt: -1 });
postSchema.index({ status: 1, boardOrder: 1, voteCount: -1 });
// Full-text search. Deployments without this index fall back to regex — see search.js.
postSchema.index({ title: "text", description: "text" }, { weights: { title: 5, description: 1 }, name: "post_text" });

postSchema.methods.toFeedJSON = function toFeedJSON(viewerId) {
  return {
    id: String(this._id),
    title: this.title,
    slug: this.slug,
    description: this.description,
    category: this.category,
    status: this.status,
    author: authorJSON(this.author),
    voteCount: this.voteCount,
    commentCount: this.commentCount,
    hasVoted: viewerId ? this.voters.some((v) => String(v) === String(viewerId)) : false,
    statusHistory: (this.statusHistory ?? []).map((h) => ({ from: h.from, to: h.to, at: h.at })),
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

postSchema.methods.refreshTrending = function refreshTrending() {
  this.trendingScore = trendingScore(this);
  return this.trendingScore;
};

export const Post = mongoose.model("Post", postSchema);
