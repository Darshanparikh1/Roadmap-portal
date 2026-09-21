import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { postKeys } from "@/features/posts";
import type { AdminPage, AdminStats, Category, Post, RoadmapColumn, SortKey, Status } from "@/lib/types";

export const adminKeys = {
  all: ["admin"] as const,
  posts: (f: object) => ["admin", "posts", f] as const,
  stats: () => ["admin", "stats"] as const,
  roadmap: () => ["roadmap"] as const,
};

export function useRoadmap() {
  return useQuery({
    queryKey: adminKeys.roadmap(),
    queryFn: ({ signal }) => api<{ columns: RoadmapColumn[] }>("/roadmap", { signal }),
  });
}

export function useAdminPosts(filters: { status: Status | null; category: Category | null; q: string; sort: SortKey; page: number }) {
  return useQuery({
    queryKey: adminKeys.posts(filters),
    queryFn: ({ signal }) => api<AdminPage>("/admin/posts", { query: { ...filters, limit: 20 }, signal }),
    placeholderData: keepPreviousData,
  });
}

export function useAdminStats() {
  return useQuery({ queryKey: adminKeys.stats(), queryFn: ({ signal }) => api<AdminStats>("/admin/stats", { signal }) });
}

/** Anything that changes a post invalidates the feed, the board and the admin table together. */
function useInvalidateAll() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: postKeys.all }),
      qc.invalidateQueries({ queryKey: adminKeys.all }),
      qc.invalidateQueries({ queryKey: adminKeys.roadmap() }),
    ]);
}

export function useUpdateStatus() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: Status }) =>
      api<Post>(`/admin/posts/${id}/status`, { method: "PATCH", body: { status } }),
    onSuccess: invalidate,
  });
}

export function useReorderColumn() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ status, orderedIds }: { status: Status; orderedIds: string[] }) =>
      api<{ status: string }>("/admin/roadmap/order", { method: "PATCH", body: { status, orderedIds } }),
    onSuccess: invalidate,
  });
}
