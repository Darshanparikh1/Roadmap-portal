import { PencilIcon, ReplyIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/auth/auth-context";
import { Markdown } from "@/components/app/markdown";
import { useSignInPrompt } from "@/components/app/sign-in-prompt";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toastManager } from "@/components/ui/toast";
import { useCreateComment, useDeleteComment, useUpdateComment } from "@/features/posts";
import { timeAgo } from "@/lib/format";
import type { Comment } from "@/lib/types";
import { cn } from "@/lib/utils";

const MAX_DEPTH = 3;

export function CommentComposer({
  postId,
  parentId = null,
  autoFocus = false,
  placeholder = "Add to the discussion…",
  onDone,
}: {
  postId: string;
  parentId?: string | null;
  autoFocus?: boolean;
  placeholder?: string;
  onDone?: () => void;
}) {
  const { user } = useAuth();
  const { prompt } = useSignInPrompt();
  const create = useCreateComment(postId);
  const [body, setBody] = useState("");

  const submit = () => {
    if (!user) return prompt("join the discussion");
    if (!body.trim()) return;
    create.mutate(
      { body: body.trim(), parentId },
      {
        onSuccess: () => {
          setBody("");
          onDone?.();
        },
        onError: (err) => toastManager.add({ title: "Comment not posted", description: err.message, type: "error" }),
      },
    );
  };

  return (
    <div className="space-y-2">
      <Textarea
        aria-label={parentId ? "Write a reply" : "Write a comment"}
        autoFocus={autoFocus}
        maxLength={4000}
        onChange={(e) => setBody(e.target.value)}
        onFocus={() => !user && prompt("join the discussion")}
        onKeyDown={(e) => {
          // ⌘/Ctrl+Enter posts, like every other comment box on the internet.
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
        placeholder={placeholder}
        style={{ minHeight: parentId ? "4.5rem" : "6rem" }}
        value={body}
      />
      <div className="flex items-center gap-2">
        <Button className={parentId ? undefined : "brand-button"} disabled={!body.trim()} loading={create.isPending} onClick={submit} size="sm">
          {parentId ? "Reply" : "Comment"}
        </Button>
        {onDone && (
          <Button onClick={onDone} size="sm" variant="ghost">
            Cancel
          </Button>
        )}
        <span className="ms-auto text-muted-foreground text-xs max-sm:hidden">Markdown supported · ⌘↵ to post</span>
      </div>
    </div>
  );
}

function CommentNode({ comment, postId }: { comment: Comment; postId: string }) {
  const [replying, setReplying] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const update = useUpdateComment(postId);
  const remove = useDeleteComment(postId);

  const save = () => {
    if (!draft.trim()) return;
    update.mutate(
      { id: comment.id, body: draft.trim() },
      {
        onSuccess: () => setEditing(false),
        onError: (err) => toastManager.add({ title: "Edit not saved", description: err.message, type: "error" }),
      },
    );
  };

  return (
    <li className={cn(comment.depth > 0 && "border-s ps-4 sm:ps-5")}>
      <div className="py-3">
        {comment.isDeleted ? (
          <p className="text-muted-foreground text-sm italic">This comment was deleted.</p>
        ) : (
          <>
            <div className="mb-1 flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium">{comment.author?.name ?? "Deleted account"}</span>
              {comment.author?.role === "admin" && <Badge size="sm" variant="info">Team</Badge>}
              <time className="text-muted-foreground text-xs" dateTime={comment.createdAt}>
                {timeAgo(comment.createdAt)}
              </time>
              {comment.editedAt && <span className="text-muted-foreground text-xs">(edited)</span>}
            </div>

            {editing ? (
              <div className="space-y-2">
                <Textarea autoFocus maxLength={4000} onChange={(e) => setDraft(e.target.value)} value={draft} />
                <div className="flex gap-2">
                  <Button loading={update.isPending} onClick={save} size="sm">
                    Save
                  </Button>
                  <Button onClick={() => { setEditing(false); setDraft(comment.body ?? ""); }} size="sm" variant="ghost">
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Markdown className="text-[0.9375rem]">{comment.body ?? ""}</Markdown>
            )}

            {!editing && (
              <div className="mt-1.5 flex flex-wrap items-center gap-1">
                {comment.depth < MAX_DEPTH && (
                  <Button onClick={() => setReplying((r) => !r)} size="xs" variant="ghost">
                    <ReplyIcon />
                    Reply
                  </Button>
                )}
                {comment.canEdit && (
                  <Button onClick={() => setEditing(true)} size="xs" variant="ghost">
                    <PencilIcon />
                    Edit
                  </Button>
                )}
                {comment.canDelete && (
                  <Button onClick={() => setConfirmDelete(true)} size="xs" variant="ghost">
                    <Trash2Icon />
                    Delete
                  </Button>
                )}
              </div>
            )}
          </>
        )}

        {replying && (
          <div className="mt-3">
            <CommentComposer autoFocus onDone={() => setReplying(false)} parentId={comment.id} placeholder="Write a reply…" postId={postId} />
          </div>
        )}
      </div>

      {comment.replies.length > 0 && (
        <ul className="ms-1">
          {comment.replies.map((reply) => (
            <CommentNode comment={reply} key={reply.id} postId={postId} />
          ))}
        </ul>
      )}

      <AlertDialog onOpenChange={setConfirmDelete} open={confirmDelete}>
        <AlertDialogPopup>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this comment?</AlertDialogTitle>
            <AlertDialogDescription>
              If it has replies, they stay in the thread and this one becomes “deleted”.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="ghost" />}>Cancel</AlertDialogClose>
            <Button
              loading={remove.isPending}
              onClick={() =>
                remove.mutate(comment.id, {
                  onSuccess: () => setConfirmDelete(false),
                  onError: (err) => toastManager.add({ title: "Couldn't delete", description: err.message, type: "error" }),
                })
              }
              variant="destructive"
            >
              Delete comment
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>
    </li>
  );
}

export function CommentThread({ comments, postId }: { comments: Comment[]; postId: string }) {
  return (
    <ul className="divide-y">
      {comments.map((comment) => (
        <CommentNode comment={comment} key={comment.id} postId={postId} />
      ))}
    </ul>
  );
}
