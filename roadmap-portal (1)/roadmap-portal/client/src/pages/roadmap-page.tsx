import { GripVerticalIcon, MessageSquareIcon } from "lucide-react";
import { type DragEvent, useEffect, useState } from "react";
import { Link } from "react-router";
import { useAuth } from "@/auth/auth-context";
import { CategoryDot } from "@/components/app/badges";
import { VoteButton } from "@/components/app/vote-button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toastManager } from "@/components/ui/toast";
import { useReorderColumn, useRoadmap, useUpdateStatus } from "@/features/admin";
import { CATEGORY_META, PRODUCT_NAME, ROADMAP_STATUSES, STATUS_META } from "@/lib/content";
import type { Post, RoadmapStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

interface DragState {
  postId: string;
  from: RoadmapStatus;
}

/**
 * Public three-column board. Admins can drag cards between and within columns; everyone else
 * gets the same board, read-only. Drag uses the native HTML5 API — no extra dependency, and it
 * keeps keyboard users on the status dropdown on the request page, which stays the source of truth.
 */
export function RoadmapPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const roadmap = useRoadmap();
  const updateStatus = useUpdateStatus();
  const reorder = useReorderColumn();

  const [columns, setColumns] = useState<Record<RoadmapStatus, Post[]>>({ planned: [], in_progress: [], completed: [] });
  const [dragging, setDragging] = useState<DragState | null>(null);
  const [over, setOver] = useState<RoadmapStatus | null>(null);

  // Mirror the server's board into local state so a drag can update instantly.
  useEffect(() => {
    if (!roadmap.data) return;
    const next = { planned: [], in_progress: [], completed: [] } as Record<RoadmapStatus, Post[]>;
    for (const column of roadmap.data.columns) next[column.status] = column.items;
    setColumns(next);
  }, [roadmap.data]);

  const onDrop = (target: RoadmapStatus, index: number | null) => {
    if (!dragging) return;
    const { postId, from } = dragging;
    setDragging(null);
    setOver(null);

    const source = [...columns[from]];
    const moving = source.find((p) => p.id === postId);
    if (!moving) return;
    const remaining = source.filter((p) => p.id !== postId);
    const destination = from === target ? remaining : [...columns[target]];
    const at = index ?? destination.length;
    destination.splice(at, 0, { ...moving, status: target });

    setColumns((prev) => ({ ...prev, [from]: from === target ? destination : remaining, [target]: destination }));

    const persistOrder = () =>
      reorder.mutate(
        { status: target, orderedIds: destination.map((p) => p.id) },
        { onError: (err) => toastManager.add({ title: "Order not saved", description: err.message, type: "error" }) },
      );

    if (from === target) {
      persistOrder();
      return;
    }
    updateStatus.mutate(
      { id: postId, status: target },
      {
        onSuccess: () => {
          toastManager.add({ title: `Moved to ${STATUS_META[target].label}`, description: moving.title, type: "success" });
          persistOrder();
        },
        onError: (err) => {
          toastManager.add({ title: "Couldn't move that card", description: err.message, type: "error" });
          void roadmap.refetch();
        },
      },
    );
  };

  return (
    <div className="relative overflow-x-clip">
      <div className="relative mx-auto max-w-6xl px-4 pb-20 sm:px-6">
      <div className="relative mb-8 pt-14 pb-12">
        <div aria-hidden="true" className="hero-band" />
        {/* Positioned, so it paints above the absolutely positioned band behind it. */}
        <div className="relative">
        <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-brand/25 bg-brand/8 px-3 py-1 font-medium text-brand-ink text-xs backdrop-blur dark:bg-brand/15">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-brand" />
          Updated as work moves
        </p>
        <h1 className="font-heading font-semibold text-4xl tracking-tight sm:text-5xl">
          <span className="brand-text">Roadmap</span>
        </h1>
        <p className="mt-3 max-w-2xl text-lg text-muted-foreground leading-relaxed">
          What the {PRODUCT_NAME} team accepted, what's being built, and what already shipped. Requests still under
          review live on the <Link className="underline underline-offset-4" to="/">requests page</Link>.
        </p>
        {isAdmin && (
          <p className="mt-3 inline-flex items-center gap-2 rounded-md border border-dashed px-3 py-1.5 text-muted-foreground text-sm">
            <GripVerticalIcon className="size-4" />
            Drag cards between columns to change status.
          </p>
        )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {ROADMAP_STATUSES.map((status) => {
          const meta = STATUS_META[status];
          const items = columns[status];
          return (
            <section
              aria-label={meta.label}
              className={cn(
                // Each column is washed in its own status colour, so the three read apart at a
                // glance — the accent bar on top and the tint come from the same token.
                "column-accent relative flex min-h-48 flex-col rounded-2xl border p-3 pt-4 transition-colors",
                "border-[color-mix(in_oklch,var(--accent-color)_28%,var(--border))]",
                "bg-[color-mix(in_oklch,var(--accent-color)_7%,var(--card))]",
                over === status && "border-brand/50 bg-brand/8 ring-2 ring-brand/25",
              )}
              style={{ "--accent-color": `var(--${status === "planned" ? "info" : status === "in_progress" ? "warning" : "success"})` } as React.CSSProperties}
              key={status}
              onDragLeave={() => setOver((c) => (c === status ? null : c))}
              onDragOver={(e: DragEvent) => {
                if (!isAdmin || !dragging) return;
                e.preventDefault();
                setOver(status);
              }}
              onDrop={(e: DragEvent) => {
                if (!isAdmin) return;
                e.preventDefault();
                onDrop(status, null);
              }}
            >
              <header className="mb-2 flex items-center justify-between px-1">
                <h2 className="flex items-center gap-2 font-heading font-semibold text-base">
                  <span aria-hidden="true" className={cn("size-2 rounded-full", meta.dot)} />
                  {meta.label}
                </h2>
                <Badge
                  className="border-[color-mix(in_oklch,var(--accent-color)_35%,transparent)] bg-[color-mix(in_oklch,var(--accent-color)_14%,transparent)] tabular-nums"
                  size="sm"
                  variant="outline"
                >
                  {roadmap.data?.columns.find((c) => c.status === status)?.total ?? items.length}
                </Badge>
              </header>
              <p className="mb-3 px-1 text-muted-foreground text-xs">{meta.blurb}</p>

              <div className="flex flex-col gap-2">
                {roadmap.isPending ? (
                  [0, 1].map((i) => <Skeleton className="h-28 rounded-lg" key={i} />)
                ) : items.length === 0 ? (
                  <p className="rounded-lg border border-dashed px-3 py-6 text-center text-muted-foreground text-sm">
                    Nothing here yet.
                  </p>
                ) : (
                  items.map((post, index) => (
                    <div
                      draggable={isAdmin}
                      key={post.id}
                      onDragEnd={() => { setDragging(null); setOver(null); }}
                      onDragStart={(e: DragEvent) => {
                        if (!isAdmin) return;
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", post.id);
                        setDragging({ postId: post.id, from: status });
                      }}
                      onDrop={(e: DragEvent) => {
                        if (!isAdmin || !dragging) return;
                        e.preventDefault();
                        e.stopPropagation();
                        onDrop(status, index);
                      }}
                    >
                      <RoadmapCard dragging={dragging?.postId === post.id} draggable={isAdmin} post={post} />
                    </div>
                  ))
                )}
              </div>
            </section>
          );
        })}
        </div>
      </div>
    </div>
  );
}

function RoadmapCard({ post, draggable, dragging }: { post: Post; draggable: boolean; dragging: boolean }) {
  return (
    <article
      className={cn(
        "lift group relative rounded-xl border bg-card p-3.5",
        draggable && "cursor-grab active:cursor-grabbing",
        dragging && "opacity-40",
      )}
    >
      <div className="mb-2.5 flex items-start justify-between gap-3">
        <h3 className="font-medium text-sm leading-snug">
          <Link className="outline-none after:absolute after:inset-0 after:rounded-xl group-hover:underline focus-visible:underline" to={`/requests/${post.slug}`}>
            {post.title}
          </Link>
        </h3>
        <VoteButton className="relative z-10" post={post} variant="inline" />
      </div>
      <div className="flex flex-wrap items-center gap-2 text-muted-foreground text-xs">
        <span className="inline-flex items-center gap-1.5">
          <CategoryDot category={post.category} />
          {CATEGORY_META[post.category].label}
        </span>
        <span className="inline-flex items-center gap-1">
          <MessageSquareIcon className="size-3.5" />
          {post.commentCount}
        </span>
      </div>
    </article>
  );
}
