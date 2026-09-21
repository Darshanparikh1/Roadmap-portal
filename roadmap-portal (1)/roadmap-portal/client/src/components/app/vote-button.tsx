import { ArrowUpIcon } from "lucide-react";
import { useAuth } from "@/auth/auth-context";
import { useSignInPrompt } from "@/components/app/sign-in-prompt";
import { toastManager } from "@/components/ui/toast";
import { useToggleVote } from "@/features/posts";
import { ApiError } from "@/lib/api";
import type { Post } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  post: Post;
  /** "stacked" is the tall arrow-over-count control on feed cards; "inline" is the compact pill. */
  variant?: "stacked" | "inline";
  size?: "default" | "lg";
  className?: string;
}

export function VoteButton({ post, variant = "stacked", size = "default", className }: Props) {
  const { user } = useAuth();
  const { prompt } = useSignInPrompt();
  const vote = useToggleVote();

  const onClick = () => {
    if (!user) return prompt("vote on this request");
    if (!user.isVerified) {
      toastManager.add({ title: "Verify your email first", description: "Voting opens once your address is confirmed.", type: "info" });
      return;
    }
    vote.mutate(post, {
      onError: (err) =>
        toastManager.add({
          title: "Vote didn't save",
          description: err instanceof ApiError ? err.message : "Try again in a moment.",
          type: "error",
        }),
    });
  };

  const label = `${post.hasVoted ? "Remove your vote from" : "Upvote"} ${post.title}`;
  const voted = post.hasVoted;

  return (
    <button
      aria-label={label}
      aria-pressed={voted}
      className={cn(
        "group inline-flex shrink-0 select-none items-center justify-center rounded-xl border font-semibold tabular-nums outline-none transition-all duration-150",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        // Voted is the one state worth shouting about, so it gets the full brand gradient;
        // everything else stays quiet until the pointer arrives.
        voted
          ? "brand-button border-transparent"
          : "border-border bg-card text-muted-foreground hover:border-brand/45 hover:bg-brand/8 hover:text-brand-ink",
        variant === "stacked"
          ? size === "lg"
            ? "w-16 flex-col gap-0.5 px-3 py-2.5"
            : "w-12 flex-col gap-0.5 px-2 py-2"
          : "gap-1.5 px-2.5 py-1 text-sm",
        className,
      )}
      onClick={onClick}
      type="button"
    >
      <ArrowUpIcon
        className={cn(
          "transition-transform duration-150 group-hover:-translate-y-0.5",
          variant === "stacked" ? (size === "lg" ? "size-4.5" : "size-4") : "size-3.5",
          voted && "-translate-y-0.5",
        )}
      />
      <span className={cn(variant === "stacked" ? (size === "lg" ? "text-base leading-none" : "text-sm leading-none") : "text-sm")}>
        {post.voteCount}
      </span>
    </button>
  );
}
