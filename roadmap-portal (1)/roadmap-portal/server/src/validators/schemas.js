import { z } from "zod";
import { CATEGORIES, STATUSES } from "../models/post.model.js";

const password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be at most 72 characters")
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), "Password must contain at least one letter and one number");

export const signupSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password,
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required").max(128),
});

export const emailOnlySchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
});

export const tokenSchema = z.object({ token: z.string().min(10).max(400) });

export const resetPasswordSchema = z.object({ token: z.string().min(10).max(400), password });

export const createPostSchema = z.object({
  title: z.string().trim().min(5, "Give it a title of at least 5 characters").max(140),
  description: z.string().trim().min(10, "Describe the request in at least 10 characters").max(10_000),
  category: z.enum(CATEGORIES).default("general"),
});

export const updatePostSchema = z
  .object({
    title: z.string().trim().min(5).max(140).optional(),
    description: z.string().trim().min(10).max(10_000).optional(),
    category: z.enum(CATEGORIES).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");

export const feedQuerySchema = z.object({
  sort: z.enum(["trending", "top", "newest", "discussed"]).default("trending"),
  category: z.enum(CATEGORIES).optional(),
  status: z.enum(STATUSES).optional(),
  q: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const idParamSchema = z.object({ id: z.string().regex(/^[a-f\d]{24}$/i, "Malformed id") });
export const slugParamSchema = z.object({ slug: z.string().trim().min(1).max(200) });

export const createCommentSchema = z.object({
  body: z.string().trim().min(1, "Write something first").max(4000),
  parentId: z.string().regex(/^[a-f\d]{24}$/i).nullable().optional(),
});

export const updateCommentSchema = z.object({ body: z.string().trim().min(1).max(4000) });

export const statusSchema = z.object({ status: z.enum(STATUSES) });

export const boardOrderSchema = z.object({
  status: z.enum(["planned", "in_progress", "completed"]),
  orderedIds: z.array(z.string().regex(/^[a-f\d]{24}$/i)).max(200),
});
