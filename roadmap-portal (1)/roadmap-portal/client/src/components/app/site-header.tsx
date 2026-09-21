import { LayoutDashboardIcon, LogOutIcon, MailIcon, RouteIcon } from "lucide-react";
import { Link, NavLink, useNavigate } from "react-router";
import { useAuth } from "@/auth/auth-context";
import { NewRequestDialog } from "@/components/app/new-request-dialog";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Menu, MenuGroup, MenuGroupLabel, MenuItem, MenuPopup, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { toastManager } from "@/components/ui/toast";
import { PRODUCT_NAME } from "@/lib/content";
import { cn } from "@/lib/utils";

export function Wordmark({ className }: { className?: string }) {
  return (
    <Link className={cn("inline-flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring", className)} to="/">
      <span
        aria-hidden="true"
        className="grid size-8 place-items-center rounded-xl bg-brand text-brand-foreground"
      >
        <RouteIcon className="size-4.5" />
      </span>
      <span className="font-heading font-semibold text-lg tracking-tight">{PRODUCT_NAME}</span>
      <span className="rounded-full bg-brand/10 px-2 py-0.5 font-medium text-brand-ink text-xs max-sm:hidden dark:bg-brand/15">
        Feedback
      </span>
    </Link>
  );
}

const navClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "rounded-lg px-3 py-1.5 font-medium text-sm transition-colors",
    isActive
      ? "bg-brand/10 text-brand-ink dark:bg-brand/15"
      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
  );

export function SiteHeader() {
  const { user, status, logout } = useAuth();
  const navigate = useNavigate();

  const onLogout = async () => {
    await logout();
    toastManager.add({ title: "Signed out", type: "success" });
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-30 border-b bg-background/72 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Wordmark />
        <nav aria-label="Main" className="ms-2 flex items-center gap-1">
          <NavLink className={navClass} end to="/">
            Requests
          </NavLink>
          <NavLink className={navClass} to="/roadmap">
            Roadmap
          </NavLink>
          {user?.role === "admin" && (
            <NavLink className={navClass} to="/admin">
              Admin
            </NavLink>
          )}
        </nav>

        <div className="ms-auto flex items-center gap-1.5">
          <div className="max-sm:hidden">
            <NewRequestDialog />
          </div>
          <ThemeToggle />
          {status === "loading" ? (
            <div className="size-8" />
          ) : user ? (
            <Menu>
              <MenuTrigger aria-label="Account menu" className="ms-1 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <Avatar className="size-8">
                  <AvatarFallback className="text-xs">{initials(user.name)}</AvatarFallback>
                </Avatar>
              </MenuTrigger>
              <MenuPopup align="end">
                <MenuGroup>
                  <MenuGroupLabel>
                    <span className="block truncate font-medium text-foreground">{user.name}</span>
                    <span className="block truncate font-normal">{user.email}</span>
                  </MenuGroupLabel>
                </MenuGroup>
                <MenuSeparator />
                {user.role === "admin" && (
                  <MenuItem onClick={() => navigate("/admin")}>
                    <LayoutDashboardIcon />
                    Admin panel
                  </MenuItem>
                )}
                <MenuItem onClick={onLogout}>
                  <LogOutIcon />
                  Sign out
                </MenuItem>
              </MenuPopup>
            </Menu>
          ) : (
            <>
              <Button className="max-lg:hidden" render={<Link to="/dev/mailbox" />} size="sm" variant="ghost">
                <MailIcon />
                Dev inbox
              </Button>
              <Button render={<Link to="/login" />} size="sm">
                Sign in
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}
