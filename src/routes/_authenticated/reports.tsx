import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Banknote, CalendarDays, Download, Search, Users } from "lucide-react";
import { AppLayout, PageHeader } from "@/components/app-layout";
import { cn } from "@/lib/utils";
import {
  formatWage,
  normalizePhone,
  selectActiveWorkers,
  useWorkers,
  type Worker,
} from "@/lib/workers-store";

import { useAttendance } from "@/lib/attendance-store";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Monthly Reports — Worker Attendance Management" },
      {
        name: "description",
        content: "Monthly attendance summaries, days worked, and payroll totals.",
      },
      {
        property: "og:title",
        content: "Monthly Reports — Worker Attendance Management",
      },
      {
        property: "og:description",
        content: "Monthly attendance summaries, days worked, and payroll totals.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: ReportsPage,
});

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type SortKey = "name" | "days";

interface ReportRow {
  worker: Worker;
  /** Number of unique dates attended in the selected month. */
  daysWorked: number;
  /** Days worked × daily wage (missing wage counts as 0). */
  totalPayment: number;
}


function SummaryCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 shadow-card">
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-primary/10">
        <Icon className="h-5 w-5 text-primary" strokeWidth={2} />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold text-foreground">{value}</p>
      </div>
    </div>
  );
}

function escapeCsv(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function exportCsv(
  rows: ReportRow[],
  month: number,
  year: number,
): void {
  const header = ["Worker Name", "Phone Number", "Days Worked", "Daily Wage", "Total Payment"];
  const lines = [header.join(",")];
  for (const { worker, daysWorked, totalPayment } of rows) {
    const dailyWage = (worker.dailyWage ?? 0).toFixed(2);
    const payment = totalPayment.toFixed(2);
    lines.push(
      [worker.fullName, worker.phone, String(daysWorked), dailyWage, payment]
        .map(escapeCsv)
        .join(","),
    );
  }

  const csv = lines.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `monthly-attendance-${year}-${String(month + 1).padStart(2, "0")}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function ReportsPage() {
  const { workers, hydrated: workersHydrated } = useWorkers();
  const { records, hydrated: attendanceHydrated } = useAttendance();

  const [month, setMonth] = useState<number | null>(null);
  const [year, setYear] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [nameQuery, setNameQuery] = useState("");

  // Default to the current month/year on the client only (avoids hydration mismatch).
  useEffect(() => {
    const now = new Date();
    setMonth((m) => m ?? now.getMonth());
    setYear((y) => y ?? now.getFullYear());
  }, []);

  const hydrated = workersHydrated && attendanceHydrated && month !== null && year !== null;

  const years = useMemo(() => {
    const now = new Date().getFullYear();
    const yearsInData = records.map((r) => Number(r.date.slice(0, 4))).filter(Boolean);
    const min = Math.min(now, ...yearsInData);
    const list: number[] = [];
    for (let y = now; y >= min; y--) list.push(y);
    return list;
  }, [records]);

  // Build the report: count unique attended dates per Worker ID in the selected month/year.
  const rows = useMemo((): ReportRow[] => {
    if (month === null || year === null) return [];
    const prefix = `${year}-${String(month + 1).padStart(2, "0")}-`;
    const datesByWorker = new Map<string, Set<string>>();
    for (const record of records) {
      if (!record.date.startsWith(prefix)) continue; // other months/years excluded
      for (const id of new Set(record.workerIds)) {
        const set = datesByWorker.get(id) ?? new Set<string>();
        set.add(record.date); // same date twice never increases the count
        datesByWorker.set(id, set);
      }
    }
    // Every active worker appears, even with zero attendance.
    return selectActiveWorkers(workers).map((worker) => {
      const daysWorked = datesByWorker.get(worker.id)?.size ?? 0;
      return {
        worker,
        daysWorked,
        totalPayment: daysWorked * (worker.dailyWage ?? 0),
      };
    });
  }, [records, workers, month, year]);

  // Filter by worker name or phone number (case-insensitive, format-insensitive).
  const filteredRows = useMemo(() => {
    const q = nameQuery.trim().toLowerCase();
    if (!q) return rows;
    const qPhone = normalizePhone(q);
    return rows.filter(
      (r) =>
        r.worker.fullName.toLowerCase().includes(q) ||
        (qPhone !== "" && normalizePhone(r.worker.phone).includes(qPhone)),
    );
  }, [rows, nameQuery]);

  const sortedRows = useMemo(() => {
    const sorted = [...filteredRows];
    sorted.sort((a, b) => {
      const cmp =
        sortKey === "name"
          ? a.worker.fullName.localeCompare(b.worker.fullName)
          : a.daysWorked - b.daysWorked;
      return sortAsc ? cmp : -cmp;
    });
    return sorted;
  }, [filteredRows, sortKey, sortAsc]);

  const workersWhoWorked = useMemo(
    () => filteredRows.filter((r) => r.daysWorked > 0).length,
    [filteredRows],
  );
  const totalDays = useMemo(() => filteredRows.reduce((sum, r) => sum + r.daysWorked, 0), [filteredRows]);
  const totalPayroll = useMemo(
    () => filteredRows.reduce((sum, r) => sum + r.totalPayment, 0),
    [filteredRows],
  );


  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const SortIcon = ({ active }: { active: boolean }) =>
    active ? (
      sortAsc ? (
        <ArrowUp className="h-3.5 w-3.5" />
      ) : (
        <ArrowDown className="h-3.5 w-3.5" />
      )
    ) : (
      <ArrowDown className="h-3.5 w-3.5 opacity-30" />
    );

  const selectClass =
    "h-10 rounded-lg border border-input bg-card px-3 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <AppLayout>
      <PageHeader
        title="Monthly Reports"
        description="Attendance summaries and payroll totals for the selected month."
      />

      {/* Month / Year selectors and search */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <select
          aria-label="Select month"
          value={month ?? ""}
          onChange={(e) => setMonth(Number(e.target.value))}
          className={selectClass}
        >
          {MONTHS.map((m, i) => (
            <option key={m} value={i}>
              {m}
            </option>
          ))}
        </select>
        <select
          aria-label="Select year"
          value={year ?? ""}
          onChange={(e) => setYear(Number(e.target.value))}
          className={selectClass}
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <div className="relative flex-1 sm:flex-none">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            aria-label="Search worker name or phone"
            placeholder="Search name or phone…"
            value={nameQuery}

            onChange={(e) => setNameQuery(e.target.value)}
            className={cn(selectClass, "w-full min-w-0 pl-9 sm:w-64")}
          />
        </div>
        <button
          type="button"
          disabled={!hydrated || sortedRows.length === 0}
          onClick={() => hydrated && month !== null && year !== null && exportCsv(sortedRows, month, year)}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </div>

      {/* Summary cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryCard icon={Users} label="Total Workers Who Worked" value={hydrated ? workersWhoWorked : "—"} />
        <SummaryCard icon={CalendarDays} label="Total Days Worked" value={hydrated ? totalDays : "—"} />
        <SummaryCard
          icon={Banknote}
          label="Total Payroll"
          value={hydrated ? formatWage(totalPayroll) : "—"}
        />

      </div>

      {/* Report table */}
      <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card shadow-card">
        {!hydrated ? null : filteredRows.length === 0 ? (
          <div className="grid place-items-center px-5 py-14 text-center">
            <div>
              <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-accent">
                <CalendarDays className="h-5 w-5 text-accent-foreground" />
              </div>
              <p className="mt-3 text-sm font-medium text-foreground">
                {nameQuery.trim() ? "No matching workers" : "No active workers"}
              </p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                {nameQuery.trim()
                  ? `No active worker matches “${nameQuery.trim()}”.`
                  : "Add workers on the Workers page to see them in this report."}
              </p>

            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-left">
                  <th className="px-5 py-3 font-medium text-muted-foreground">
                    <button
                      type="button"
                      onClick={() => toggleSort("name")}
                      className={cn(
                        "inline-flex items-center gap-1.5 hover:text-foreground",
                        sortKey === "name" && "text-foreground",
                      )}
                    >
                      Worker Name
                      <SortIcon active={sortKey === "name"} />
                    </button>
                  </th>
                  <th className="px-5 py-3 font-medium text-muted-foreground">Phone Number</th>
                  <th className="px-5 py-3 font-medium text-muted-foreground">
                    <button
                      type="button"
                      onClick={() => toggleSort("days")}
                      className={cn(
                        "inline-flex items-center gap-1.5 hover:text-foreground",
                        sortKey === "days" && "text-foreground",
                      )}
                    >
                      Days Worked
                      <SortIcon active={sortKey === "days"} />
                    </button>
                  </th>
                  <th className="px-5 py-3 font-medium text-muted-foreground">Daily Wage</th>
                  <th className="px-5 py-3 text-right font-medium text-muted-foreground">
                    Total Payment
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sortedRows.map(({ worker, daysWorked, totalPayment }) => (
                  <tr key={worker.id} className="transition-colors hover:bg-accent/40">
                    <td className="px-5 py-3 font-medium text-foreground">{worker.fullName}</td>
                    <td className="px-5 py-3 text-muted-foreground">{worker.phone}</td>
                    <td className="px-5 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
                          daysWorked > 0
                            ? "bg-success/10 text-success"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {daysWorked} day{daysWorked === 1 ? "" : "s"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {formatWage(worker.dailyWage ?? 0)}
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-foreground">
                      {formatWage(totalPayment)}
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
