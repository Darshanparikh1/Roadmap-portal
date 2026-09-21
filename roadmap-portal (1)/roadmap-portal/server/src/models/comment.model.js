import mongoose from "mongoose";
import { authorJSON } from "./user.model.js";

/**
 * Threaded comments, adjacency-list style: each comment knows its parent, and the tree is
 * assembled in memory. Depth is capped so a thread stays readable (and so the UI can't be
 * pushed off the right edge of the screen).
 */
export const MAX_COMMENT_DEPTH = 3;

const commentSchema = new mongoose.Schema(
  {
    post: { type: mongoose.Schema.Types.ObjectId, ref: "Post", required: true, index: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: "Comment", default: null, index: true },
    depth: { type: Number, default: 0, min: 0, max: MAX_COMMENT_DEPTH },
    // A deleted comment keeps a row (so replies stay anchored) but loses its text,
    // which is why `required` only applies while it is alive.
    body: {
      type: String,
      required: function requiredWhileAlive() {
        return !this.isDeleted;
      },
      maxlength: 4000,
      default: "",
    }, // markdown
    isDeleted: { type: Boolean, default: false },
    editedAt: { type: Date },
  },
  { timestamps: true },
);

commentSchema.index({ post: 1, createdAt: 1 });

commentSchema.methods.toJSONFor = function toJSONFor(viewer) {
  const isAuthor = viewer && String(this.author?._id ?? this.author) === String(viewer.id ?? viewer._id);
  const isAdmin = viewer?.role === "admin";
  return {
    id: String(this._id),
    postId: String(this.post),
    parentId: this.parent ? String(this.parent) : null,
    depth: this.depth,
    // A deleted comment with replies stays as a tombstone so the thread doesn't lose its shape.
    body: this.isDeleted ? null : this.body,
    isDeleted: this.isDeleted,
    author: this.isDeleted ? null : authorJSON(this.author),
    editedAt: this.editedAt ?? null,
    createdAt: this.createdAt,
    canEdit: Boolean(!this.isDeleted && isAuthor),
    canDelete: Boolean(!this.isDeleted && (isAuthor || isAdmin)),
    replies: [],
  };
};

export const Comment = mongoose.model("Comment", commentSchema);

/** Turns a flat, chronologically sorted list into a reply tree. */
export function buildCommentTree(comments, viewer) {
  const nodes = new Map();
  const roots = [];
  for (const c of comments) {
    const node = c.toJSONFor(viewer);
    nodes.set(node.id, node);
  }
  for (const node of nodes.values()) {
    if (node.parentId && nodes.has(node.parentId)) nodes.get(node.parentId).replies.push(node);
    else roots.push(node);
  }
  return roots;
}
