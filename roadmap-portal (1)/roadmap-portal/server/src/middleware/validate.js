import { ApiError } from "../utils/api-error.js";

/**
 * Validates and replaces req.body / req.query / req.params with the parsed result, so handlers
 * receive coerced, trimmed, known-shaped data and never touch raw input.
 */
export const validate = (schemas) => (req, _res, next) => {
  for (const key of ["body", "query", "params"]) {
    const schema = schemas[key];
    if (!schema) continue;
    const result = schema.safeParse(req[key]);
    if (!result.success) {
      const details = {};
      for (const issue of result.error.issues) {
        const field = issue.path.join(".") || key;
        details[field] ??= issue.message;
      }
      return next(new ApiError(422, "validation_error", Object.values(details)[0] ?? "Invalid request", details));
    }
    if (key === "query") {
      // Express 5 exposes req.query as a getter; keep the parsed copy beside it.
      req.validatedQuery = result.data;
    } else {
      req[key] = result.data;
    }
  }
  next();
};
