import { type FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useAuth } from "@/auth/auth-context";
import { Markdown } from "@/components/app/markdown";
import { Button } from "@/components/ui/button";
import { Card, CardPanel } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { toastManager } from "@/components/ui/toast";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { usePost, useUpdatePost } from "@/features/posts";
import { ApiError } from "@/lib/api";
import { CATEGORIES, CATEGORY_META } from "@/lib/content";
import type { Category } from "@/lib/types";

export function EditRequestPage() {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const post = usePost(slug);
  const update = useUpdatePost();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<Category>("general");
  const [preview, setPreview] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (post.data && !loaded) {
      setTitle(post.data.title);
      setDescription(post.data.description);
      setCategory(post.data.category);
      setLoaded(true);
    }
  }, [post.data, loaded]);

  if (post.isPending) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <Spinner className="size-5 text-muted-foreground" />
      </div>
    );
  }
  if (post.isError) return <p className="p-10 text-center text-muted-foreground">Couldn't load this request.</p>;

  const entry = post.data;
  const allowed = user && (user.id === entry.author?.id || user.role === "admin");
  if (!allowed) {
    return (
      <div className="mx-auto max-w-lg p-10 text-center">
        <p className="text-muted-foreground">Only the person who posted this request can edit it.</p>
        <Button className="mt-4" render={<Link to={`/requests/${entry.slug}`} />} variant="outline">
          Back to the request
        </Button>
      </div>
    );
  }

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (title.trim().length < 5) next.title = "Give it a title of at least 5 characters";
    if (description.trim().length < 10) next.description = "Describe the request in at least 10 characters";
    setErrors(next);
    if (Object.keys(next).length) return;

    try {
      const updated = await update.mutateAsync({
        id: entry.id,
        data: { title: title.trim(), description: description.trim(), category },
      });
      toastManager.add({ title: "Request updated", type: "success" });
      navigate(`/requests/${updated.slug}`);
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.details).length) setErrors(err.details);
      else toastManager.add({ title: "Not saved", description: (err as Error).message, type: "error" });
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="mb-6 font-heading font-semibold text-2xl tracking-tight">Edit request</h1>
      <Card>
        <CardPanel>
          <form className="flex flex-col gap-5" onSubmit={onSubmit}>
            <Field invalid={Boolean(errors.title)} name="title">
              <FieldLabel>Title</FieldLabel>
              <Input maxLength={140} onChange={(e) => setTitle(e.target.value)} value={title} />
              {errors.title && <FieldError match>{errors.title}</FieldError>}
            </Field>

            <div>
              <span className="mb-2 block font-medium text-sm" id="edit-category">
                Category
              </span>
              <ToggleGroup
                aria-labelledby="edit-category"
                className="flex-wrap"
                onValueChange={(v) => v[0] && setCategory(v[0] as Category)}
                size="sm"
                value={[category]}
                variant="outline"
              >
                {CATEGORIES.map((c) => (
                  <ToggleGroupItem className="rounded-full px-3" key={c} value={c}>
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
                <Textarea maxLength={10_000} onChange={(e) => setDescription(e.target.value)} style={{ minHeight: "12rem" }} value={description} />
              )}
              {errors.description ? <FieldError match>{errors.description}</FieldError> : <FieldDescription>Markdown supported.</FieldDescription>}
            </Field>

            <div className="flex gap-2">
              <Button loading={update.isPending} type="submit">
                Save changes
              </Button>
              <Button render={<Link to={`/requests/${entry.slug}`} />} type="button" variant="ghost">
                Cancel
              </Button>
            </div>
          </form>
        </CardPanel>
      </Card>
    </div>
  );
}
