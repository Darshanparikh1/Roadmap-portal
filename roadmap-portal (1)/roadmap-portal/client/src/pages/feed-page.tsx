import { CheckCircle2Icon, HammerIcon, MessagesSquareIcon, SearchXIcon } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { NewRequestDialog } from "@/components/app/new-request-dialog";
import { PostCard, PostCardSkeleton } from "@/components/app/post-card";
import { SearchField } from "@/components/app/search-field";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTab } from "@/components/ui/tabs";
import { useRoadmap } from "@/features/admin";
import { useFeed } from "@/features/posts";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { CATEGORIES, CATEGORY_META, PRODUCT_NAME, SORTS, STATUSES, STATUS_META, isCategory, isSort, isStatus } from "@/lib/content";
import type { Category, SortKey, Status } from "@/lib/types";
import { cn } from "@/lib/utils";

export function FeedPage() {
  const [params, setParams] = useSearchParams();
  const sort: SortKey = isSort(params.get("sort")) ? (params.get("sort") as SortKey) : "trending";
  const category = isCategory(params.get("category")) ? (params.get("category") as Category) : null;
  const status = isStatus(params.get("status")) ? (params.get("status") as Status) : null;

  const [search, setSearch] = useState(params.get("q") ?? "");
  const q = useDebouncedValue(search.trim(), 300);
  const urlQ = params.get("q") ?? "";

  // Keep the debounced search in the URL so a filtered view is a shareable link.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only react to the debounced value
  useEffect(() => {
    if (urlQ === q) return;
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (q) next.set("q", q);
      else next.delete("q");
      return next;
    }, { replace: true });
  }, [q]);

  const setParam = (key: string, value: string | null) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    }, { replace: true });
  };

  const feed = useFeed({ sort, category, status, q });
  const posts = feed.data?.pages.flatMap((p) => p.items) ?? [];
  const total = feed.data?.pages[0]?.total ?? 0;
  const filtered = Boolean(category || status || q);

  const sentinel = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = feed;
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasNextPage) return;
    const io = new IntersectionObserver(([e]) => {
      if (e?.isIntersecting && !isFetchingNextPage) void fetchNextPage();
    }, { rootMargin: "500px" });
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const roadmap = useRoadmap();
  const shipped = roadmap.data?.columns.find((c) => c.status === "completed")?.total;
  const building = roadmap.data?.columns.find((c) => c.status === "in_progress")?.total;

  return (
    <div className="relative overflow-x-clip">
      <div className="relative mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        {/* The band is a sibling of the hero inside this wrapper, so it is exactly as tall —
            the header's own padding lives here rather than on the container. */}
        <div className="relative mb-10 pt-14 pb-12">
          <div aria-hidden="true" className="hero-band" />
          <section className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-brand/25 bg-brand/8 px-3 py-1 font-medium text-brand-ink text-xs backdrop-blur dark:bg-brand/15">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-brand" />
              Public feedback board
            </p>
            <h1 className="text-balance font-heading font-semibold text-4xl leading-[1.05] tracking-tight sm:text-5xl">
              Tell us what to <span className="brand-text">build next</span>
            </h1>
            <p className="mt-4 max-w-xl text-lg text-muted-foreground leading-relaxed">
              Post an idea, upvote the ones you need, and follow exactly what the {PRODUCT_NAME} team picks up.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <NewRequestDialog />
              <Button render={<Link to="/roadmap" />} variant="outline">
                View the roadmap
              </Button>
            </div>
          </div>

          <dl className="grid grid-cols-3 gap-3 lg:w-80">
            <HeroStat icon={<MessagesSquareIcon />} label="Requests" tone="brand" value={total || undefined} />
            <HeroStat icon={<HammerIcon />} label="Building" tone="warning" value={building} />
            <HeroStat icon={<CheckCircle2Icon />} label="Shipped" tone="success" value={shipped} />
          </dl>
          </section>
        </div>

      <div className="sticky top-16 z-20 -mx-4 mb-4 flex flex-col gap-3 border-b bg-background/80 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <Tabs onValueChange={(v) => setParam("sort", v === "trending" ? null : String(v))} value={sort}>
          <TabsList>
            {SORTS.map((s) => (
              <TabsTab key={s.key} value={s.key}>
                {s.label}
              </TabsTab>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex flex-wrap items-center gap-2">
          <Select onValueChange={(v) => setParam("category", v === "all" ? null : String(v))} value={category ?? "all"}>
            <SelectTrigger className="w-40" size="sm">
              <SelectValue>{(v) => (v === "all" ? "All categories" : CATEGORY_META[v as Category].label)}</SelectValue>
            </SelectTrigger>
            <SelectPopup>
              <SelectItem value="all">All categories</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {CATEGORY_META[c].label}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>

          <Select onValueChange={(v) => setParam("status", v === "all" ? null : String(v))} value={status ?? "all"}>
            <SelectTrigger className="w-40" size="sm">
              <SelectValue>{(v) => (v === "all" ? "Any status" : STATUS_META[v as Status].label)}</SelectValue>
            </SelectTrigger>
            <SelectPopup>
              <SelectItem value="all">Any status</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_META[s].label}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>

          <SearchField
            className="w-full sm:w-56"
            onChange={setSearch}
            pending={feed.isFetching && !feed.isFetchingNextPage && search.trim() !== ""}
            placeholder="Search requests"
            value={search}
          />
        </div>
      </div>

      <p aria-live="polite" className="mb-4 text-muted-foreground text-sm">
        {feed.isSuccess ? `${total} ${total === 1 ? "request" : "requests"}${q ? ` matching “${q}”` : ""}` : "\u00a0"}
      </p>

      <div className={cn("space-y-3 transition-opacity", feed.isPlaceholderData && "opacity-60")}>
        {feed.isPending ? (
          [0, 1, 2, 3].map((i) => <PostCardSkeleton key={i} />)
        ) : feed.isError ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Requests didn't load</EmptyTitle>
              <EmptyDescription>{feed.error.message}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button onClick={() => feed.refetch()} size="sm" variant="outline">
                Try again
              </Button>
            </EmptyContent>
          </Empty>
        ) : posts.length === 0 ? (
          <Empty className="rounded-xl border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <SearchXIcon />
              </EmptyMedia>
              <EmptyTitle>{filtered ? "Nothing matches those filters" : "No requests yet"}</EmptyTitle>
              <EmptyDescription>
                {filtered ? "Try a different search or clear the filters." : "Be the first to suggest something."}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              {filtered ? (
                <Button onClick={() => { setSearch(""); setParams({}, { replace: true }); }} size="sm" variant="outline">
                  Clear filters
                </Button>
              ) : (
                <NewRequestDialog />
              )}
            </EmptyContent>
          </Empty>
        ) : (
          posts.map((post) => <PostCard key={post.id} post={post} />)
        )}
      </div>

      <div ref={sentinel} />
        {hasNextPage && (
          <div className="mt-6 flex justify-center">
            <Button loading={isFetchingNextPage} onClick={() => fetchNextPage()} variant="outline">
              Load more
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/** One tile per headline number. The tone colours the icon so the three read as a set. */
function HeroStat({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: number | undefined;
  tone: "brand" | "warning" | "success";
}) {
  const tones = {
    brand: "bg-brand/10 text-brand-ink dark:bg-brand/15",
    warning: "bg-warning/15 text-warning-foreground dark:bg-warning/20",
    success: "bg-success/12 text-success-foreground dark:bg-success/20",
  } as const;
  return (
    <div className="rounded-xl border bg-card/70 p-3 backdrop-blur">
      <dt className="flex items-center gap-2 text-muted-foreground text-xs">
        <span aria-hidden="true" className={cn("grid size-6 place-items-center rounded-lg [&_svg]:size-3.5", tones[tone])}>
          {icon}
        </span>
        {label}
      </dt>
      <dd className="mt-1 font-heading font-semibold text-2xl tabular-nums">
        {value === undefined ? <span className="inline-block h-7 w-8 animate-pulse rounded bg-muted align-middle" /> : value}
      </dd>
    </div>
  );
}
