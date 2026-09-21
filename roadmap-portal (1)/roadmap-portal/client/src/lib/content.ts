import type { BadgeProps } from "@/components/ui/badge";
import type { Category, RoadmapStatus, SortKey, Status } from "@/lib/types";

export const PRODUCT_NAME: string = import.meta.env.VITE_PRODUCT_NAME || "Throughline";

export const CATEGORIES: Category[] = ["ui_ux", "integrations", "performance", "general"];

export const CATEGORY_META: Record<Category, { label: string; hint: string }> = {
  ui_ux: { label: "UI/UX", hint: "How it looks and feels" },
  integrations: { label: "Integrations", hint: "Other tools and APIs" },
  performance: { label: "Performance", hint: "Speed and reliability" },
  general: { label: "General", hint: "Anything else" },
};

export const STATUSES: Status[] = ["under_review", "planned", "in_progress", "completed"];
export const ROADMAP_STATUSES: RoadmapStatus[] = ["planned", "in_progress", "completed"];

export const STATUS_META: Record<
  Status,
  { label: string; badge: NonNullable<BadgeProps["variant"]>; dot: string; blurb: string }
> = {
  under_review: { label: "Under review", badge: "secondary", dot: "bg-muted-foreground", blurb: "We've seen it and we're weighing it up" },
  planned: { label: "Planned", badge: "info", dot: "bg-info", blurb: "Accepted and waiting for a slot" },
  in_progress: { label: "In progress", badge: "warning", dot: "bg-warning", blurb: "Being built right now" },
  completed: { label: "Completed", badge: "success", dot: "bg-success", blurb: "Shipped and live" },
};

export const SORTS: { key: SortKey; label: string }[] = [
  { key: "trending", label: "Trending" },
  { key: "top", label: "Most voted" },
  { key: "newest", label: "Newest" },
  { key: "discussed", label: "Most discussed" },
];

export const isCategory = (v: string | null): v is Category => CATEGORIES.includes(v as Category);
export const isStatus = (v: string | null): v is Status => STATUSES.includes(v as Status);
export const isSort = (v: string | null): v is SortKey => SORTS.some((s) => s.key === v);
