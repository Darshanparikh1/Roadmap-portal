import { ExternalLinkIcon } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { CategoryBadge, StatusBadge } from "@/components/app/badges";
import { SearchField } from "@/components/app/search-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardPanel } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTab } from "@/components/ui/tabs";
import { toastManager } from "@/components/ui/toast";
import { useAdminPosts, useAdminStats, useUpdateStatus } from "@/features/admin";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { CATEGORIES, CATEGORY_META, SORTS, STATUSES, STATUS_META } from "@/lib/content";
import { timeAgo } from "@/lib/format";
import type { Category, SortKey, Status } from "@/lib/types";

export function AdminPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [sort, setSort] = useState<SortKey>("newest");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const q = useDebouncedValue(search.trim(), 300);

  const list = useAdminPosts({ status, category, q, sort, page });
  const stats = useAdminStats();
  const updateStatus = useUpdateStatus();
  const counts = list.data?.counts;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <h1 className="font-heading font-semibold text-3xl tracking-tight">Admin panel</h1>
        <p className="mt-1.5 text-muted-foreground">Triage incoming requests and move them along the roadmap.</p>
      </div>

      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Requests" value={stats.data ? Object.values(stats.data.posts).reduce((a, b) => a + b, 0) : undefined} />
        <StatCard label="Under review" value={stats.data?.posts.under_review ?? 0} />
        <StatCard label="Members" value={stats.data?.users} />
        <StatCard label="Comments" value={stats.data?.comments} />
      </div>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs
          onValueChange={(v) => {
            setStatus(v === "all" ? null : (v as Status));
            setPage(1);
          }}
          value={status ?? "all"}
        >
          <TabsList>
            <TabsTab value="all">All {counts && <span className="text-muted-foreground tabular-nums">{counts.all}</span>}</TabsTab>
            {STATUSES.map((s) => (
              <TabsTab key={s} value={s}>
                {STATUS_META[s].label} {counts && <span className="text-muted-foreground tabular-nums">{counts[s] ?? 0}</span>}
              </TabsTab>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex flex-wrap items-center gap-2">
          <Select onValueChange={(v) => { setCategory(v === "all" ? null : (v as Category)); setPage(1); }} value={category ?? "all"}>
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
          <Select onValueChange={(v) => setSort(v as SortKey)} value={sort}>
            <SelectTrigger className="w-36" size="sm">
              <SelectValue>{(v) => SORTS.find((s) => s.key === v)?.label ?? String(v)}</SelectValue>
            </SelectTrigger>
            <SelectPopup>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="top">Most voted</SelectItem>
              <SelectItem value="trending">Trending</SelectItem>
              <SelectItem value="discussed">Most discussed</SelectItem>
            </SelectPopup>
          </Select>
          <SearchField className="w-full sm:w-56" onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search requests" value={search} />
        </div>
      </div>

      {list.isPending ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton className="h-14 rounded-lg" key={i} />
          ))}
        </div>
      ) : list.isError ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Couldn't load requests</EmptyTitle>
            <EmptyDescription>{list.error.message}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : list.data.items.length === 0 ? (
        <Empty className="rounded-xl border border-dashed">
          <EmptyHeader>
            <EmptyTitle>Nothing here</EmptyTitle>
            <EmptyDescription>No requests match these filters.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <Table className={list.isPlaceholderData ? "opacity-60" : undefined} variant="card">
            <TableHeader>
              <TableRow>
                <TableHead>Request</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-end">Votes</TableHead>
                <TableHead className="text-end">Comments</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10"><span className="sr-only">Open</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.data.items.map((post) => (
                <TableRow key={post.id}>
                  <TableCell className="max-w-80">
                    <Link className="block truncate font-medium hover:underline" to={`/requests/${post.slug}`}>
                      {post.title}
                    </Link>
                    <span className="block truncate text-muted-foreground text-xs">
                      {post.author?.name ?? "Deleted account"} · {timeAgo(post.createdAt)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <CategoryBadge category={post.category} size="sm" />
                  </TableCell>
                  <TableCell className="text-end tabular-nums">{post.voteCount}</TableCell>
                  <TableCell className="text-end tabular-nums">{post.commentCount}</TableCell>
                  <TableCell>
                    <Select
                      onValueChange={(v) =>
                        updateStatus.mutate(
                          { id: post.id, status: v as Status },
                          {
                            onSuccess: () => toastManager.add({ title: `Moved to ${STATUS_META[v as Status].label}`, description: post.title, type: "success" }),
                            onError: (err) => toastManager.add({ title: "Couldn't change status", description: err.message, type: "error" }),
                          },
                        )
                      }
                      value={post.status}
                    >
                      <SelectTrigger className="w-40" size="sm">
                        <SelectValue>{(v) => STATUS_META[v as Status].label}</SelectValue>
                      </SelectTrigger>
                      <SelectPopup>
                        {STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {STATUS_META[s].label}
                          </SelectItem>
                        ))}
                      </SelectPopup>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Button aria-label={`Open ${post.title}`} render={<Link to={`/requests/${post.slug}`} />} size="icon-sm" variant="ghost">
                      <ExternalLinkIcon />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {(page > 1 || list.data.hasMore) && (
            <div className="mt-4 flex items-center justify-end gap-2">
              <span className="me-2 text-muted-foreground text-sm">Page {page}</span>
              <Button disabled={page === 1} onClick={() => setPage((p) => p - 1)} size="sm" variant="outline">
                Previous
              </Button>
              <Button disabled={!list.data.hasMore} onClick={() => setPage((p) => p + 1)} size="sm" variant="outline">
                Next
              </Button>
            </div>
          )}
        </>
      )}

      {stats.data && stats.data.topRequests.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 font-heading font-semibold text-lg">Most wanted</h2>
          <Card>
            <CardPanel className="divide-y p-0">
              {stats.data.topRequests.map((r) => (
                <div className="flex items-center gap-3 px-4 py-3" key={r.id}>
                  <Badge className="tabular-nums" variant="secondary">
                    {r.voteCount}
                  </Badge>
                  <Link className="min-w-0 flex-1 truncate text-sm hover:underline" to={`/requests/${r.slug}`}>
                    {r.title}
                  </Link>
                  <StatusBadge size="sm" status={r.status} />
                </div>
              ))}
            </CardPanel>
          </Card>
        </section>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | undefined }) {
  return (
    <Card>
      <CardPanel className="py-4">
        <p className="text-muted-foreground text-sm">{label}</p>
        {value === undefined ? (
          <Skeleton className="mt-1 h-7 w-12" />
        ) : (
          <p className="mt-0.5 font-heading font-semibold text-2xl tabular-nums">{value}</p>
        )}
      </CardPanel>
    </Card>
  );
}
