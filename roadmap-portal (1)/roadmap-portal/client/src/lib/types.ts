export type Category = "ui_ux" | "integrations" | "performance" | "general";
export type Status = "under_review" | "planned" | "in_progress" | "completed";
export type RoadmapStatus = Exclude<Status, "under_review">;
export type SortKey = "trending" | "top" | "newest" | "discussed";

export interface User {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  isVerified: boolean;
  createdAt: string;
}

export interface AuthResponse {
  user: User;
  accessTokenExpiresAt: string;
}

export interface Author {
  id: string;
  name: string;
  role: "user" | "admin";
}

export interface Post {
  id: string;
  title: string;
  slug: string;
  description: string;
  category: Category;
  status: Status;
  author: Author | null;
  voteCount: number;
  commentCount: number;
  hasVoted: boolean;
  statusHistory: { from: Status; to: Status; at: string }[];
  createdAt: string;
  updatedAt: string;
}

export interface Page<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

export interface AdminPage extends Page<Post> {
  counts: Record<"all" | Status, number>;
}

export interface Comment {
  id: string;
  postId: string;
  parentId: string | null;
  depth: number;
  body: string | null;
  isDeleted: boolean;
  author: Author | null;
  editedAt: string | null;
  createdAt: string;
  canEdit: boolean;
  canDelete: boolean;
  replies: Comment[];
}

export interface RoadmapColumn {
  status: RoadmapStatus;
  total: number;
  items: Post[];
}

export interface AdminStats {
  posts: Partial<Record<Status, number>>;
  categories: Partial<Record<Category, number>>;
  users: number;
  comments: number;
  topRequests: { id: string; title: string; slug: string; voteCount: number; status: Status }[];
}

export interface OutboxEmail {
  id: string;
  to: string;
  subject: string;
  body: string;
  actionUrl: string | null;
  createdAt: string;
}
