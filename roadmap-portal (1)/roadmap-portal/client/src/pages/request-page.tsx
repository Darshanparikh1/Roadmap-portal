import { ArrowLeftIcon, LockIcon, MessageSquareIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { useAuth } from "@/auth/auth-context";
import { CategoryBadge, StatusBadge } from "@/components/app/badges";
import { CommentComposer, CommentThread } from "@/components/app/comment-thread";
import { Markdown } from "@/components/app/markdown";
import { VoteButton } from "@/components/app/vote-button";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toastManager } from "@/components/ui/toast";
import { useUpdateStatus } from "@/features/admin";
import { useComments, useDeletePost, usePost } from "@/features/posts";
import { PRODUCT_NAME, STATUSES, STATUS_META } from "@/lib/content";
import { formatDate, timeAgo } from "@/lib/format";
import type { Status } from "@/lib/types";

export function RequestPage() {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const location = useLocation();
  const post = usePost(slug);
  const comments = useComments(post.data?.id);
  const updateStatus = useUpdateStatus();
  const deletePost = useDeletePost();
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (post.data) document.title = `${post.data.title} · ${PRODUCT_NAME}`;
    return () => {
      document.title = "Feature requests & roadmap";
    };
  }, [post.data]);

  if (post.isPending) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-10 sm:px-6">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (post.isError) {
    return (
      <Empty className="py-24">
        <EmptyHeader>
          <EmptyTitle>{(post.error as { status?: number }).status === 404 ? "Request not found" : "Couldn't load this request"}</EmptyTitle>
          <EmptyDescription>It may have been deleted, or the link is mistyped.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button render={<Link to="/" />} size="sm" variant="outline">
            Back to all requests
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  const entry = post.data;
  const isOwner = user && entry.author && user.id === entry.author.id;
  const isAdmin = user?.role === "admin";

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Button className="mb-6 -ms-2" render={<Link to="/" />} size="sm" variant="ghost">
        <ArrowLeftIcon />
        All requests
      </Button>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-10">
        {/* ---------------- main column ---------------- */}
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2 lg:hidden">
            <StatusBadge status={entry.status} />
            <CategoryBadge category={entry.category} />
          </div>

          <h1 className="text-balance font-heading font-semibold text-3xl leading-tight tracking-tight sm:text-4xl">
            {entry.title}
          </h1>
          <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground text-sm">
            <span className="font-medium text-foreground">{entry.author?.name ?? "Deleted account"}</span>
            <span aria-hidden="true">·</span>
            <time dateTime={entry.createdAt}>{timeAgo(entry.createdAt)}</time>
          </p>

          <Markdown className="mt-6">{entry.description}</Markdown>

          {/* the vote control travels with the content on small screens */}
          <div className="mt-6 flex items-center gap-3 lg:hidden">
            <VoteButton post={entry} size="lg" />
            <span className="text-muted-foreground text-sm">
              {entry.voteCount === 1 ? "1 person wants this" : `${entry.voteCount} people want this`}
            </span>
          </div>

          <section aria-labelledby="discussion" className="mt-10 border-t pt-8">
            <h2 className="mb-5 flex items-center gap-2 font-heading font-semibold text-xl" id="discussion">
              <MessageSquareIcon className="size-5 text-muted-foreground" />
              Discussion
              <span className="font-normal text-muted-foreground text-base">({comments.data?.total ?? entry.commentCount})</span>
            </h2>

            {/* The discussion is for members. A signed-out visitor sees that it exists — the count
                is on the card either way — but not what anyone wrote. The API enforces this; the
                panel below is just the polite version of the 401. */}
            {!user ? (
              <div className="rounded-2xl border border-dashed px-6 py-10 text-center">
                <LockIcon aria-hidden="true" className="mx-auto mb-3 size-5 text-muted-foreground" />
                <p className="font-medium">Sign in to read the discussion</p>
                <p className="mx-auto mt-1 max-w-sm text-muted-foreground text-sm leading-relaxed">
                  {entry.commentCount === 0
                    ? "Be the first to comment on this request."
                    : `This request has ${entry.commentCount} comment${entry.commentCount === 1 ? "" : "s"}. Accounts keep the conversation accountable — every comment is signed.`}
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  <Button className="brand-button" render={<Link state={{ from: location.pathname }} to="/login" />}>
                    Sign in
                  </Button>
                  <Button render={<Link state={{ from: location.pathname }} to="/signup" />} variant="outline">
                    Create an account
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <CommentComposer postId={entry.id} />

                <div className="mt-6">
                  {comments.isPending ? (
                    <div className="space-y-3">
                      <Skeleton className="h-16 w-full" />
                      <Skeleton className="h-16 w-full" />
                    </div>
                  ) : comments.data && comments.data.items.length > 0 ? (
                    <CommentThread comments={comments.data.items} postId={entry.id} />
                  ) : (
                    <p className="rounded-xl border border-dashed py-8 text-center text-muted-foreground text-sm">
                      No comments yet. Start the discussion.
                    </p>
                  )}
                </div>
              </>
            )}
          </section>
        </div>

        {/* ---------------- sidebar ---------------- */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border bg-card p-4">
            <div className="flex items-center gap-3 max-lg:hidden">
              <VoteButton post={entry} size="lg" />
              <div>
                <p className="font-medium text-sm">{entry.hasVoted ? "You voted for this" : "Want this too?"}</p>
                <p className="text-muted-foreground text-xs">
                  {entry.voteCount === 1 ? "1 vote so far" : `${entry.voteCount} votes so far`}
                </p>
              </div>
            </div>

            <dl className="space-y-3 text-sm lg:mt-5 lg:border-t lg:pt-4">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">Status</dt>
                <dd>
                  <StatusBadge size="sm" status={entry.status} />
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">Category</dt>
                <dd>
                  <CategoryBadge category={entry.category} size="sm" />
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">Posted</dt>
                <dd>{formatDate(entry.createdAt)}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">Comments</dt>
                <dd className="tabular-nums">{comments.data?.total ?? entry.commentCount}</dd>
              </div>
            </dl>

            {entry.statusHistory.length > 0 && (
              <div className="mt-4 border-t pt-4">
                <p className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">History</p>
                <ol className="space-y-2">
                  {entry.statusHistory.map((h) => (
                    <li className="flex flex-wrap items-center gap-1.5 text-xs" key={`${h.to}-${h.at}`}>
                      <StatusBadge size="sm" status={h.to} />
                      <time className="text-muted-foreground" dateTime={h.at}>
                        {formatDate(h.at)}
                      </time>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>

          {(isAdmin || isOwner) && (
            <div className="mt-4 rounded-2xl border border-dashed p-4">
              <p className="mb-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                {isAdmin ? "Admin controls" : "Your request"}
              </p>
              <div className="flex flex-col gap-2">
                {isAdmin && (
                  <Select
                    onValueChange={(v) =>
                      updateStatus.mutate(
                        { id: entry.id, status: v as Status },
                        {
                          onSuccess: () => toastManager.add({ title: `Moved to ${STATUS_META[v as Status].label}`, type: "success" }),
                          onError: (err) => toastManager.add({ title: "Couldn't change status", description: err.message, type: "error" }),
                        },
                      )
                    }
                    value={entry.status}
                  >
                    <SelectTrigger className="w-full" size="sm">
                      <SelectValue>{(v) => STATUS_META[v as Status].label}</SelectValue>
                    </SelectTrigger>
                    <SelectPopup>
                      {STATUSES.map((st) => (
                        <SelectItem key={st} value={st}>
                          {STATUS_META[st].label}
                        </SelectItem>
                      ))}
                    </SelectPopup>
                  </Select>
                )}
                {isOwner && (
                  <Button render={<Link to={`/requests/${entry.slug}/edit`} />} size="sm" variant="outline">
                    <PencilIcon />
                    Edit request
                  </Button>
                )}
                <Button onClick={() => setConfirmDelete(true)} size="sm" variant="ghost">
                  <Trash2Icon />
                  Delete request
                </Button>
              </div>
            </div>
          )}
        </aside>
      </div>

      <AlertDialog onOpenChange={setConfirmDelete} open={confirmDelete}>
        <AlertDialogPopup>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this request?</AlertDialogTitle>
            <AlertDialogDescription>
              “{entry.title}” and its {entry.commentCount} comment(s) will be removed for everyone. Votes go with it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="ghost" />}>Cancel</AlertDialogClose>
            <Button
              loading={deletePost.isPending}
              onClick={() =>
                deletePost.mutate(entry.id, {
                  onSuccess: () => {
                    toastManager.add({ title: "Request deleted", type: "success" });
                    navigate("/");
                  },
                  onError: (err) => toastManager.add({ title: "Couldn't delete", description: err.message, type: "error" }),
                })
              }
              variant="destructive"
            >
              Delete request
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>
    </div>
  );
}
