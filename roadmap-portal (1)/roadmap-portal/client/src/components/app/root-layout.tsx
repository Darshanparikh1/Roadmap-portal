import { Outlet } from "react-router";
import { SiteHeader } from "@/components/app/site-header";
import { PRODUCT_NAME } from "@/lib/content";

export function RootLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        className="sr-only rounded-md bg-primary px-3 py-2 text-primary-foreground text-sm focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-50"
        href="#main"
      >
        Skip to content
      </a>
      <SiteHeader />
      <main className="flex-1" id="main">
        <Outlet />
      </main>
      <footer className="border-t">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-muted-foreground text-sm sm:px-6">
          <span>{PRODUCT_NAME} feature requests</span>
          <span>Built with Express, MongoDB and React</span>
        </div>
      </footer>
    </div>
  );
}
