import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ClipboardCheck,
  FileBarChart,
  LayoutDashboard,
  LogOut,
  Menu,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

function SignOutButton({ onDone }: { onDone?: () => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        onDone?.();
        await queryClient.cancelQueries();
        queryClient.clear();
        await supabase.auth.signOut();
        void navigate({ to: "/auth", replace: true });
      }}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-60"
    >
      <LogOut className="h-4.5 w-4.5 shrink-0" strokeWidth={2} />
      <span className="truncate">{busy ? "Signing out…" : "Sign Out"}</span>
    </button>
  );
}

const NAV_ITEMS = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, exact: true },
  { title: "Workers", url: "/workers", icon: Users, exact: false },
  { title: "Daily Attendance", url: "/attendance", icon: ClipboardCheck, exact: false },
  { title: "Monthly Reports", url: "/reports", icon: FileBarChart, exact: false },
];

function NavLinks({
  currentPath,
  onNavigate,
  compact,
}: {
  currentPath: string;
  onNavigate?: () => void;
  compact?: boolean;
}) {
  return (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const active = item.exact ? currentPath === item.url : currentPath.startsWith(item.url);
        return (
          <Link
            key={item.title}
            to={item.url}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            <item.icon className="h-4.5 w-4.5 shrink-0" strokeWidth={2} />
            <span className="truncate">{item.title}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-3 px-2">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
        <ClipboardCheck className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-bold leading-tight text-foreground">
          Worker Attendance
        </p>
        <p className="text-xs text-muted-foreground">Management System</p>
      </div>
    </div>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const currentPath = useRouterState({ select: (s) => s.location.pathname });
  const activeItem = NAV_ITEMS.find((item) =>
    item.exact ? currentPath === item.url : currentPath.startsWith(item.url),
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <div className="flex h-16 items-center border-b border-sidebar-border px-4">
          <Brand />
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <NavLinks currentPath={currentPath} />
        </div>
        <div className="border-t border-sidebar-border px-3 py-3">
          <SignOutButton />
        </div>
      </aside>

      {/* Mobile header */}
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-card/95 px-4 backdrop-blur md:hidden">
        <button
          type="button"
          aria-label="Open navigation"
          onClick={() => setMobileOpen(true)}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-input text-foreground hover:bg-accent"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="truncate text-sm font-semibold">{activeItem?.title ?? "Worker Attendance"}</h1>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 left-0 flex w-64 flex-col bg-sidebar shadow-xl">
            <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-3">
              <Brand />
              <button
                type="button"
                aria-label="Close navigation"
                onClick={() => setMobileOpen(false)}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-accent"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-4">
              <NavLinks currentPath={currentPath} onNavigate={() => setMobileOpen(false)} />
            </div>
            <div className="border-t border-sidebar-border px-3 py-3">
              <SignOutButton onDone={() => setMobileOpen(false)} />
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="md:pl-64">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 md:py-8 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
      <div className="min-w-0">
        <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function PlaceholderCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-card">
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <div className="grid place-items-center px-5 py-14 text-center">
        <div>
          <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-accent">
            <ClipboardCheck className="h-5 w-5 text-accent-foreground" />
          </div>
          <p className="mt-3 text-sm font-medium text-foreground">Coming in a later phase</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  );
}
