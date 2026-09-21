import {
  type InfiniteData,
  type QueryClient,
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useAuth } from "@/auth/auth-context";
import { api } from "@/lib/api";
import type { Category, Comment, Page, Post, SortKey, Status } from "@/lib/types";

const PAGE_SIZE = 10;

export interface FeedFilters {
  sort: SortKey;
  category: Category | null;
  status: Status | null;
  q: string;
}

export const postKeys = {
  all: ["posts"] as const,
  feed: (f: FeedFilters) => ["posts", "feed", f] as const,
  detail: (slug: string) => ["posts", "detail", slug] as const,
  comments: (id: string) => ["posts", id, "comments"] as const,
};

export function useFeed(filters: FeedFilters) {
  return useInfiniteQuery({
    queryKey: postKeys.feed(filters),
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      api<Page<Post>>("/posts", {
        query: {
          page: pageParam,
          limit: PAGE_SIZE,
          sort: filters.sort,
          category: filters.category,
          status: filters.status,
          q: filters.q,
        },
        signal,
      }),
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    placeholderData: keepPreviousData, // keeps results on screen while a new search loads
  });
}

export function usePost(slug: string) {
  return useQuery({
    queryKey: postKeys.detail(slug),
    queryFn: ({ signal }) => api<Post>(`/posts/${encodeURIComponent(slug)}`, { signal }),
    retry: (count, err) => (err as { status?: number }).status !== 404 && count < 2,
  });
}

export function useCreatePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { title: string; description: string; category: Category }) =>
      api<Post>("/posts", { method: "POST", body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: postKeys.all }),
  });
}

export function useUpdatePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Pick<Post, "title" | "description" | "category">> }) =>
      api<Post>(`/posts/${id}`, { method: "PATCH", body: data }),
    onSuccess: (post) => {
      qc.setQueryData(postKeys.detail(post.slug), post);
      void qc.invalidateQueries({ queryKey: postKeys.all });
    },
  });
}

export function useDeletePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/posts/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: postKeys.all }),
  });
}

/* ------------------------------------------------------------------ voting */
type Cached = Post | Page<Post> | InfiniteData<Page<Post>> | { columns: { items: Post[] }[] } | undefined;

function patch(data: Cached, id: string, apply: (p: Post) => Post): Cached {
  if (!data) return data;
  if ("pages" in data) {
    return { ...data, pages: data.pages.map((p) => ({ ...p, items: p.items.map((x) => (x.id === id ? apply(x) : x)) })) };
  }
  if ("columns" in data) {
    return { ...data, columns: data.columns.map((c) => ({ ...c, items: c.items.map((x) => (x.id === id ? apply(x) : x)) })) };
  }
  if ("items" in data) return { ...data, items: data.items.map((x) => (x.id === id ? apply(x) : x)) };
  return data.id === id ? apply(data) : data;
}

/**
 * Optimistic upvote: the count moves the instant you click, and every cached copy of that post
 * (feed, detail page, roadmap column, admin table) moves with it. If the request fails, the
 * previous snapshot is restored — no half-updated screen.
 */
export function useToggleVote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (post: Pick<Post, "id">) =>
      api<{ id: string; voteCount: number; hasVoted: boolean }>(`/posts/${post.id}/vote`, { method: "POST" }),
    onMutate: async (post) => {
      await qc.cancelQueries();
      const snapshot = qc.getQueriesData<Cached>({});
      qc.setQueriesData<Cached>({}, (old) =>
        patch(old, post.id, (p) => ({
          ...p,
          hasVoted: !p.hasVoted,
          voteCount: Math.max(0, p.voteCount + (p.hasVoted ? -1 : 1)),
        })),
      );
      return { snapshot };
    },
    onError: (_err, _vars, ctx) => {
      ctx?.snapshot.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSuccess: (res) => {
      // Reconcile with the server's authoritative count.
      qc.setQueriesData<Cached>({}, (old) =>
        patch(old, res.id, (p) => ({ ...p, voteCount: res.voteCount, hasVoted: res.hasVoted })),
      );
    },
  });
}

/* ---------------------------------------------------------------- comments */
/**
 * Reading the discussion requires an account, so this stays disabled while signed out rather
 * than firing a request that is certain to come back 401.
 */
export function useComments(postId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: postKeys.comments(postId ?? ""),
    queryFn: ({ signal }) => api<{ items: Comment[]; total: number }>(`/posts/${postId}/comments`, { signal }),
    enabled: Boolean(postId) && Boolean(user),
  });
}

function bumpCommentCount(qc: QueryClient, postId: string, delta: number) {
  qc.setQueriesData<Cached>({}, (old) =>
    patch(old, postId, (p) => ({ ...p, commentCount: Math.max(0, p.commentCount + delta) })),
  );
}

export function useCreateComment(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { body: string; parentId?: string | null }) =>
      api<Comment>(`/posts/${postId}/comments`, { method: "POST", body: data }),
    onSuccess: () => {
      bumpCommentCount(qc, postId, 1);
      return qc.invalidateQueries({ queryKey: postKeys.comments(postId) });
    },
  });
}

export function useUpdateComment(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) =>
      api<Comment>(`/comments/${id}`, { method: "PATCH", body: { body } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: postKeys.comments(postId) }),
  });
}

export function useDeleteComment(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/comments/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      bumpCommentCount(qc, postId, -1);
      return qc.invalidateQueries({ queryKey: postKeys.comments(postId) });
    },
  });
}
