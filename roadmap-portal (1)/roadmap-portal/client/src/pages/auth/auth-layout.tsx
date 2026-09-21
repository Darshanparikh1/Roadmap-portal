import { CheckCircle2Icon, MessagesSquareIcon, TrendingUpIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/app/site-header";
import { PRODUCT_NAME } from "@/lib/content";

const POINTS = [
  { icon: MessagesSquareIcon, title: "Post what you need", body: "Describe the problem in your words — markdown, code and all." },
  { icon: TrendingUpIcon, title: "One vote per person", body: "Accounts keep the board honest, so the counts mean something." },
  { icon: CheckCircle2Icon, title: "Follow it through", body: "See exactly when your request is planned, built and shipped." },
];

/**
 * Split layout: the form sits on the left where the eye lands, with a quiet brand panel on the
 * right that collapses away below `lg` rather than pushing the form down the page.
 */
export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="relative grid min-h-[calc(100dvh-4rem)] lg:grid-cols-2">
      <div className="relative flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm">
          <Wordmark className="mb-8 lg:hidden" />
          <h1 className="font-heading font-semibold text-2xl tracking-tight">{title}</h1>
          {description && <p className="mt-2 text-muted-foreground text-sm leading-relaxed">{description}</p>}
          <div className="mt-7">{children}</div>
          {footer && <div className="mt-7 text-muted-foreground text-sm">{footer}</div>}
        </div>
      </div>

      {/* A single flat brand tint on the panel — no gradient, no second hue. */}
      <div className="relative hidden overflow-hidden border-s bg-brand/6 lg:block dark:bg-brand/10">
        <div className="relative flex h-full flex-col justify-center px-12 py-16">
          {/* Wordmark is already a link home — don't nest another one around it. */}
          <Wordmark className="mb-10" />
          <h2 className="max-w-sm text-balance font-heading font-semibold text-2xl leading-snug tracking-tight">
            The {PRODUCT_NAME} roadmap is built from what people actually ask for.
          </h2>
          <ul className="mt-10 space-y-6">
            {POINTS.map(({ icon: Icon, title: heading, body }) => (
              <li className="flex gap-4" key={heading}>
                <span
                  aria-hidden="true"
                  className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl border border-brand/25 bg-brand/10 dark:bg-brand/15"
                >
                  <Icon className="size-4.5 text-brand-ink" />
                </span>
                <div>
                  <p className="font-medium text-sm">{heading}</p>
                  <p className="mt-0.5 max-w-xs text-muted-foreground text-sm">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export function TextLink({ children, ...props }: React.ComponentProps<"a">) {
  return (
    <a className="font-medium text-brand-ink underline-offset-4 hover:underline" {...props}>
      {children}
    </a>
  );
}
