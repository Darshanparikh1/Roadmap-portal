import { Router } from "express";
import { optionalAuth, requireAdmin, requireAuth, requireVerified } from "../middleware/auth.js";
import { authLimiter, writeLimiter } from "../middleware/rate-limit.js";
import { validate } from "../middleware/validate.js";
import * as auth from "../controllers/auth.controller.js";
import * as posts from "../controllers/post.controller.js";
import * as admin from "../controllers/admin.controller.js";
import * as dev from "../controllers/dev.controller.js";
import {
  boardOrderSchema,
  createCommentSchema,
  createPostSchema,
  emailOnlySchema,
  feedQuerySchema,
  idParamSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
  slugParamSchema,
  statusSchema,
  tokenSchema,
  updateCommentSchema,
  updatePostSchema,
} from "../validators/schemas.js";

export const router = Router();

router.get("/health", (_req, res) => res.json({ status: "ok" }));

/* ----------------------------------------------------------------- auth */
const authRoutes = Router();
authRoutes.post("/signup", authLimiter, validate({ body: signupSchema }), auth.signup);
authRoutes.post("/verify-email", validate({ body: tokenSchema }), auth.verifyEmail);
authRoutes.post("/resend-verification", authLimiter, validate({ body: emailOnlySchema }), auth.resendVerification);
authRoutes.post("/login", authLimiter, validate({ body: loginSchema }), auth.login);
authRoutes.post("/refresh", auth.refresh);
authRoutes.post("/logout", auth.logout);
authRoutes.post("/forgot-password", authLimiter, validate({ body: emailOnlySchema }), auth.forgotPassword);
authRoutes.post("/reset-password", authLimiter, validate({ body: resetPasswordSchema }), auth.resetPassword);
authRoutes.get("/me", requireAuth, auth.me);
router.use("/auth", authRoutes);

/* ------------------------------------------------------- feature requests */
const postRoutes = Router();
postRoutes.get("/", optionalAuth, validate({ query: feedQuerySchema }), posts.listPosts);
postRoutes.post("/", requireAuth, requireVerified, writeLimiter, validate({ body: createPostSchema }), posts.createPost);
postRoutes.get("/:slug", optionalAuth, validate({ params: slugParamSchema }), posts.getPost);
postRoutes.patch("/:id", requireAuth, validate({ params: idParamSchema, body: updatePostSchema }), posts.updatePost);
postRoutes.delete("/:id", requireAuth, validate({ params: idParamSchema }), posts.deletePost);
// Voting is deliberately its own endpoint: it's the hot path and it's idempotent per user.
postRoutes.post("/:id/vote", requireAuth, requireVerified, validate({ params: idParamSchema }), posts.toggleVote);
// Reading the discussion needs an account. The feed, a request and the roadmap stay public —
// anonymous visitors have to see a request before they can be prompted to sign in over it.
postRoutes.get("/:id/comments", requireAuth, validate({ params: idParamSchema }), posts.listComments);
postRoutes.post(
  "/:id/comments",
  requireAuth,
  requireVerified,
  writeLimiter,
  validate({ params: idParamSchema, body: createCommentSchema }),
  posts.createComment,
);
router.use("/posts", postRoutes);

const commentRoutes = Router();
commentRoutes.patch("/:id", requireAuth, validate({ params: idParamSchema, body: updateCommentSchema }), posts.updateComment);
commentRoutes.delete("/:id", requireAuth, validate({ params: idParamSchema }), posts.deleteComment);
router.use("/comments", commentRoutes);

/* -------------------------------------------------------------- roadmap */
router.get("/roadmap", optionalAuth, admin.getRoadmap);

/* ---------------------------------------------------------------- admin */
const adminRoutes = Router();
adminRoutes.use(requireAuth, requireAdmin);
adminRoutes.get("/posts", validate({ query: feedQuerySchema }), admin.adminListPosts);
adminRoutes.get("/stats", admin.adminStats);
adminRoutes.patch("/posts/:id/status", validate({ params: idParamSchema, body: statusSchema }), admin.updateStatus);
adminRoutes.patch("/roadmap/order", validate({ body: boardOrderSchema }), admin.reorderColumn);
router.use("/admin", adminRoutes);

/* ------------------------------------------------ dev-only email inbox */
router.get("/dev/mailbox", dev.mailbox);
