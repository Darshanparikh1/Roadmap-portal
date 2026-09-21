import { Badge } from "@/components/ui/badge";
import { CATEGORY_META, STATUS_META } from "@/lib/content";
import type { Category, Status } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * One colour per category, so the feed can be scanned without reading every chip.
 *
 * The fill is the category hue at low alpha and the text is the same hue darkened, which keeps
 * the chips vivid while the label stays legible — a saturated hue used as text at full strength
 * would fail contrast on white.
 */
const CATEGORY_STYLE: Record<Category, string> = {
  ui_ux: "border-cat-ui/35 bg-cat-ui/12 text-[color-mix(in_oklch,var(--cat-ui)_78%,black)] dark:text-cat-ui dark:bg-cat-ui/18",
  integrations:
    "border-cat-integrations/35 bg-cat-integrations/12 text-[color-mix(in_oklch,var(--cat-integrations)_78%,black)] dark:text-cat-integrations dark:bg-cat-integrations/18",
  performance:
    "border-cat-performance/35 bg-cat-performance/14 text-[color-mix(in_oklch,var(--cat-performance)_72%,black)] dark:text-cat-performance dark:bg-cat-performance/18",
  general:
    "border-cat-general/35 bg-cat-general/12 text-[color-mix(in_oklch,var(--cat-general)_74%,black)] dark:text-cat-general dark:bg-cat-general/18",
};

export function CategoryBadge({ category, size, className }: { category: Category; size?: "sm" | "default" | "lg"; className?: string }) {
  return (
    <Badge className={cn("font-medium", CATEGORY_STYLE[category], className)} size={size} variant="outline">
      {CATEGORY_META[category].label}
    </Badge>
  );
}

export function StatusBadge({ status, size, className }: { status: Status; size?: "sm" | "default" | "lg"; className?: string }) {
  const meta = STATUS_META[status];
  return (
    <Badge className={className} size={size} variant={meta.badge}>
      <span aria-hidden="true" className={cn("size-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </Badge>
  );
}

export function CategoryDot({ category, className }: { category: Category; className?: string }) {
  const color: Record<Category, string> = {
    ui_ux: "bg-cat-ui",
    integrations: "bg-cat-integrations",
    performance: "bg-cat-performance",
    general: "bg-cat-general",
  };
  return <span aria-hidden="true" className={cn("size-2 rounded-full", color[category], className)} />;
}
