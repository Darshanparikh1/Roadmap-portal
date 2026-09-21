import { env } from "../config/env.js";
import { Post } from "../models/post.model.js";

/**
 * Search across titles and descriptions.
 *
 * MongoDB's text index is the right tool (stemming, stop words, weighted fields), but it only
 * exists where the index was built. So "auto" tries $text once, remembers if the deployment
 * rejects it, and falls back to a case-insensitive regex — the API keeps working either way.
 */
let textSearchWorks = env.SEARCH_MODE === "text" ? true : env.SEARCH_MODE === "regex" ? false : null;

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function regexFilter(q) {
  // Every word must appear somewhere in the title or the description.
  return {
    $and: q
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 6)
      .map((term) => {
        const rx = new RegExp(escapeRegex(term), "i");
        return { $or: [{ title: rx }, { description: rx }] };
      }),
  };
}

/**
 * Runs `run(filter)` with the best search filter available, retrying with regex if the text
 * index turns out to be missing.
 */
export async function withSearch(q, baseFilter, run) {
  if (!q) return run(baseFilter);

  if (textSearchWorks !== false) {
    try {
      const result = await run({ ...baseFilter, $text: { $search: q } });
      textSearchWorks = true;
      return result;
    } catch (err) {
      if (env.SEARCH_MODE === "text") throw err;
      textSearchWorks = false; // remembered for the life of the process
      if (env.NODE_ENV !== "test") console.warn("Text search unavailable, using regex search:", err.codeName ?? err.message);
    }
  }
  return run({ ...baseFilter, ...regexFilter(q) });
}

/** Unique, URL-safe slug derived from the title. */
export async function uniqueSlug(title) {
  const base =
    title
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "request";
  let slug = base;
  for (let n = 2; await Post.exists({ slug }); n += 1) slug = `${base}-${n}`;
  return slug;
}
