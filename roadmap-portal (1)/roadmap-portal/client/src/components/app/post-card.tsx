import { MessageSquareIcon } from "lucide-react";
import { Link } from "react-router";
import { CategoryBadge, StatusBadge } from "@/components/app/badges";
import { plainText } from "@/components/app/markdown";
import { VoteButton } from "@/components/app/vote-button";
import { timeAgo } from "@/lib/format";
import type { Post } from "@/lib/types";

export function PostCard({ post }: { post: Post }) {
  return (
    <article className="lift group relative flex gap-4 rounded-2xl border bg-card p-4 hover:border-brand/35 sm:gap-5 sm:p-5">
      {/* Above the stretched link below, or clicking the vote control would navigate instead. */}
      <VoteButton className="relative z-10" post={post} />

      <div className="min-w-0 flex-1">
        <h3 className="font-heading font-semibold text-[1.0625rem] leading-snug tracking-tight sm:text-lg">
          {/* Stretched link: the whole card is clickable, but only the title is a link for screen readers. */}
          <Link className="outline-none after:absolute after:inset-0 after:rounded-2xl group-hover:underline focus-visible:underline" to={`/requests/${post.slug}`}>
            {post.title}
          </Link>
        </h3>

        <p className="mt-1.5 line-clamp-2 text-muted-foreground text-sm leading-relaxed">{plainText(post.description, 180)}</p>

        <div className="mt-3.5 flex flex-wrap items-center gap-2">
          <StatusBadge size="sm" status={post.status} />
          <CategoryBadge category={post.category} size="sm" />
          <span className="ms-auto flex items-center gap-3 text-muted-foreground text-xs">
            <span className="inline-flex items-center gap-1">
              <MessageSquareIcon className="size-3.5" />
              {post.commentCount}
            </span>
            <span className="max-sm:hidden">{post.author?.name ?? "Deleted account"}</span>
            <time dateTime={post.createdAt}>{timeAgo(post.createdAt)}</time>
          </span>
        </div>
      </div>
    </article>
  );
}

export function PostCardSkeleton() {
  return (
    <div aria-busy="true" className="flex gap-5 rounded-2xl border bg-card p-5">
      <div className="h-14 w-12 animate-pulse rounded-xl bg-muted" />
      <div className="flex-1 space-y-3">
        <div className="h-5 w-2/3 animate-pulse rounded bg-muted" />
        <div className="h-4 w-full animate-pulse rounded bg-muted" />
        <div className="flex gap-2">
          <div className="h-5 w-24 animate-pulse rounded-full bg-muted" />
          <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
        </div>
      </div>
    </div>
  );
}
