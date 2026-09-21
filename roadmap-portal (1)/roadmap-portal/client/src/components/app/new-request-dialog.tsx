import { PlusIcon } from "lucide-react";
import { type FormEvent, type ReactElement, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "@/auth/auth-context";
import { Markdown } from "@/components/app/markdown";
import { useSignInPrompt } from "@/components/app/sign-in-prompt";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogDescription, DialogFooter, DialogHeader, DialogPopup, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toastManager } from "@/components/ui/toast";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useCreatePost } from "@/features/posts";
import { ApiError } from "@/lib/api";
import { CATEGORIES, CATEGORY_META } from "@/lib/content";
import type { Category } from "@/lib/types";

/** The "submit a request" modal: validated form, markdown description, category tags. */
export function NewRequestDialog({ trigger }: { trigger?: ReactElement }) {
  const { user } = useAuth();
  const { prompt } = useSignInPrompt();
  const navigate = useNavigate();
  const create = useCreatePost();

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<Category>("general");
  const [preview, setPreview] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const openDialog = () => {
    if (!user) return prompt("post a feature request");
    if (!user.isVerified) {
      toastManager.add({ title: "Verify your email first", description: "Posting opens once your address is confirmed.", type: "info" });
      return;
    }
    setOpen(true);
  };

  const reset = () => {
    setTitle("");
    setDescription("");
    setCategory("general");
    setPreview(false);
    setErrors({});
    setFormError(null);
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (title.trim().length < 5) next.title = "Give it a title of at least 5 characters";
    if (description.trim().length < 10) next.description = "Describe the request in at least 10 characters";
    setErrors(next);
    if (Object.keys(next).length) return;

    try {
      const post = await create.mutateAsync({ title: title.trim(), description: description.trim(), category });
      toastManager.add({ title: "Request posted", description: "It starts with your vote.", type: "success" });
      setOpen(false);
      reset();
      navigate(`/requests/${post.slug}`);
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.details).length) setErrors(err.details);
      else setFormError((err as Error).message);
    }
  };

  return (
    <>
      {trigger ? (
        <span onClick={openDialog} onKeyDown={(e) => e.key === "Enter" && openDialog()}>
          {trigger}
        </span>
      ) : (
        <Button className="brand-button shadow-sm" onClick={openDialog}>
          <PlusIcon />
          New request
        </Button>
      )}

      <Dialog onOpenChange={(next) => { setOpen(next); if (!next) reset(); }} open={open}>
        <DialogPopup className="sm:max-w-xl">
          <form onSubmit={onSubmit}>
            <DialogHeader>
              <DialogTitle>Suggest a feature</DialogTitle>
              <DialogDescription>
                One idea per request. If it already exists, upvote that one instead — it carries more weight.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-5 px-6 py-5">
              {formError && (
                <Alert variant="error">
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              )}

              <Field invalid={Boolean(errors.title)} name="title">
                <FieldLabel>Title</FieldLabel>
                <Input
                  autoFocus
                  maxLength={140}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Dark mode for the dashboard"
                  value={title}
                />
                {errors.title ? <FieldError match>{errors.title}</FieldError> : <FieldDescription>Short and specific works best.</FieldDescription>}
              </Field>

              <div>
                <span className="mb-2 block font-medium text-sm" id="category-label">
                  Category
                </span>
                <ToggleGroup
                  aria-labelledby="category-label"
                  className="flex-wrap"
                  onValueChange={(v) => v[0] && setCategory(v[0] as Category)}
                  size="sm"
                  value={[category]}
                  variant="outline"
                >
                  {CATEGORIES.map((c) => (
                    <ToggleGroupItem className="rounded-full px-3" key={c} title={CATEGORY_META[c].hint} value={c}>
                      {CATEGORY_META[c].label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>

              <Field invalid={Boolean(errors.description)} name="description">
                <div className="flex w-full items-center justify-between">
                  <FieldLabel>Description</FieldLabel>
                  <Button onClick={() => setPreview((p) => !p)} size="xs" type="button" variant="ghost">
                    {preview ? "Write" : "Preview"}
                  </Button>
                </div>
                {preview ? (
                  <div className="min-h-40 w-full rounded-lg border bg-muted/40 p-3">
                    <Markdown>{description || "_Nothing to preview yet._"}</Markdown>
                  </div>
                ) : (
                  <Textarea
                    maxLength={10_000}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={"What problem does this solve? Who does it affect?\n\nMarkdown works: **bold**, lists, `code`."}
                    style={{ minHeight: "10rem" }}
                    value={description}
                  />
                )}
                {errors.description ? (
                  <FieldError match>{errors.description}</FieldError>
                ) : (
                  <FieldDescription>Markdown supported. Say what you're trying to do, not just what to build.</FieldDescription>
                )}
              </Field>
            </div>

            <DialogFooter>
              <DialogClose render={<Button type="button" variant="ghost" />}>Cancel</DialogClose>
              <Button loading={create.isPending} type="submit">
                Post request
              </Button>
            </DialogFooter>
          </form>
        </DialogPopup>
      </Dialog>
    </>
  );
}
