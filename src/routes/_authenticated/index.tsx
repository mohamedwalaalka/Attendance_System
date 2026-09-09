import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  CalendarCheck,
  ClipboardCheck,
  UserCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { selectActiveWorkers, useWorkers } from "@/lib/workers-store";
import { countInMonth, countPresentOn, toDateKey, useAttendance } from "@/lib/attendance-store";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Worker Attendance Management" },
      {
        name: "description",
        content: "Overview of worker attendance, today's status, and key attendance metrics.",
      },
      { property: "og:title", content: "Dashboard — Worker Attendance Management" },
      {
        property: "og:description",
        content: "Overview of worker attendance, today's status, and key attendance metrics.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: DashboardPage,
});

function useFormattedDate() {
  const [dateText, setDateText] = useState<string>("");
  useEffect(() => {
    const now = new Date();
    setDateText(
      now.toLocaleDateString(undefined, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    );
  }, []);
  return dateText;
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  hint: string;
  accent: "primary" | "success";
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-foreground">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        </div>
        <div
          className={
            "grid h-11 w-11 shrink-0 place-items-center rounded-lg " +
            (accent === "primary"
              ? "bg-primary/10 text-primary"
              : "bg-success/10 text-success")
          }
        >
          <Icon className="h-5 w-5" strokeWidth={2} />
        </div>
      </div>
    </div>
  );
}

function formatActivityDate(dateKey: string): string {
  const d = new Date(`${dateKey}T00:00:00`);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function RecentActivity({
  items,
}: {
  items: { workerId: string; name: string; date: string }[];
}) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-card">
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-sm font-semibold">Recent Activity</h2>
      </div>
      {items.length === 0 ? (
        <div className="grid place-items-center px-5 py-14 text-center">
          <div>
            <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-accent">
              <ClipboardCheck className="h-5 w-5 text-accent-foreground" />
            </div>
            <p className="mt-3 text-sm font-medium text-foreground">No activity yet</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Once attendance is registered, recent attendance activity will appear here.
            </p>
          </div>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((item, i) => (
            <li
              key={`${item.workerId}-${item.date}-${i}`}
              className="flex items-center justify-between gap-3 px-5 py-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-success/10">
                  <UserCheck className="h-4 w-4 text-success" strokeWidth={2} />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                  <p className="text-xs text-muted-foreground">Marked present</p>
                </div>
              </div>
              <span className="shrink-0 text-xs font-medium text-muted-foreground">
                {formatActivityDate(item.date)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DashboardPage() {
  const dateText = useFormattedDate();
  const { workers } = useWorkers();
  const totalWorkers = selectActiveWorkers(workers).length;

  const { records, recent } = useAttendance();
  // Compute today's key on the client only (avoids SSR/hydration mismatch).
  const [todayKey, setTodayKey] = useState<string | null>(null);
  useEffect(() => {
    setTodayKey(toDateKey(new Date()));
  }, []);
  const workedToday = todayKey ? countPresentOn(records, todayKey) : 0;

  const [month, setMonth] = useState<{ year: number; index: number } | null>(null);
  useEffect(() => {
    const now = new Date();
    setMonth({ year: now.getFullYear(), index: now.getMonth() });
  }, []);
  const monthAttendance = month ? countInMonth(records, month.year, month.index) : 0;

  const recentItems = (recent ?? []).map((r) => ({
    workerId: r.workerId,
    name: workers.find((w) => w.id === r.workerId)?.fullName ?? "Unknown worker",
    date: r.date,
  }));

  return (
    <AppLayout>
      {/* Dashboard header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">
            {dateText || "\u00A0"}
          </p>
          <h1 className="mt-0.5 text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            A quick overview of today's attendance and workforce activity.
          </p>
        </div>
        <Link
          to="/attendance"
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          <ClipboardCheck className="h-4 w-4" strokeWidth={2} />
          Register Today's Attendance
        </Link>
      </div>

      {/* Summary cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryCard
          icon={Users}
          label="Total Workers"
          value={totalWorkers}
          hint="Active registered workers"
          accent="primary"
        />
        <SummaryCard
          icon={UserCheck}
          label="Worked Today"
          value={workedToday}
          hint="Marked present today"
          accent="success"
        />
        <SummaryCard
          icon={CalendarCheck}
          label="This Month's Attendance"
          value={monthAttendance}
          hint="Attendance records this month"
          accent="primary"
        />
      </div>

      {/* Recent activity */}
      <div className="mt-6">
        <RecentActivity items={recentItems} />
      </div>
    </AppLayout>
  );
}
