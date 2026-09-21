import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, createBrowserRouter } from "react-router";
import { AuthProvider } from "@/auth/auth-context";
import { GuestOnly, RequireAdmin } from "@/auth/guards";
import { RootLayout } from "@/components/app/root-layout";
import { SignInPromptProvider } from "@/components/app/sign-in-prompt";
import { ToastProvider } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ApiError } from "@/lib/api";
import { EditRequestPage } from "@/pages/edit-request-page";
import { FeedPage } from "@/pages/feed-page";
import { RequestPage } from "@/pages/request-page";
import { RoadmapPage } from "@/pages/roadmap-page";
import { DevMailboxPage } from "@/pages/dev-mailbox-page";
import { NotFoundPage } from "@/pages/not-found-page";
import { ForgotPasswordPage } from "@/pages/auth/forgot-password-page";
import { LoginPage } from "@/pages/auth/login-page";
import { ResetPasswordPage } from "@/pages/auth/reset-password-page";
import { SignupPage } from "@/pages/auth/signup-page";
import { VerifyEmailPage } from "@/pages/auth/verify-email-page";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // 4xx responses won't fix themselves; only retry network and server failures.
      retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
    },
  },
});

function Providers() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <ToastProvider>
            <SignInPromptProvider>
              <Outlet />
            </SignInPromptProvider>
          </ToastProvider>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export const router = createBrowserRouter([
  {
    element: <Providers />,
    children: [
      {
        element: <RootLayout />,
        children: [
          { index: true, element: <FeedPage /> },
          { path: "requests/:slug", element: <RequestPage /> },
          { path: "requests/:slug/edit", element: <EditRequestPage /> },
          { path: "roadmap", element: <RoadmapPage /> },
          {
            path: "admin",
            // The studio is its own chunk; visitors browsing requests never download it.
            element: (
              <RequireAdmin>
                <Outlet />
              </RequireAdmin>
            ),
            children: [
              {
                index: true,
                lazy: async () => ({ Component: (await import("@/pages/admin/admin-page")).AdminPage }),
              },
            ],
          },
          { path: "login", element: <GuestOnly><LoginPage /></GuestOnly> },
          { path: "signup", element: <GuestOnly><SignupPage /></GuestOnly> },
          { path: "forgot-password", element: <GuestOnly><ForgotPasswordPage /></GuestOnly> },
          { path: "verify-email", element: <VerifyEmailPage /> },
          { path: "reset-password", element: <ResetPasswordPage /> },
          { path: "dev/mailbox", element: <DevMailboxPage /> },
          { path: "*", element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);
