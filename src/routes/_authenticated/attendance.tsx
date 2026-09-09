import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CalendarIcon, ClipboardCheck, Search } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { AppLayout, PageHeader } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  selectActiveWorkers,
  searchWorkers,
  useWorkers,
} from "@/lib/workers-store";
import { toDateKey, useAttendance } from "@/lib/attendance-store";

export const Route = createFileRoute("/_authenticated/attendance")({
  head: () => ({
    meta: [
      { title: "Daily Attendance — Worker Attendance Management" },
      {
        name: "description",
        content: "Record and review daily attendance for all workers.",
      },
      {
        property: "og:title",
        content: "Daily Attendance — Worker Attendance Management",
      },
      {
        property: "og:description",
        content: "Record and review daily attendance for all workers.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: AttendancePage,
});

function AttendancePage() {
  const { workers, hydrated: workersHydrated } = useWorkers();
  const { hydrated: attendanceHydrated, saveAttendance, getRecordForDate } =
    useAttendance();

  const [date, setDate] = useState<Date | undefined>(undefined);
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Default to today on the client only (avoids hydration mismatch).
  useEffect(() => {
    setDate((d) => d ?? new Date());
  }, []);

  const dateKey = date ? toDateKey(date) : undefined;
  const existing = dateKey ? getRecordForDate(dateKey) : undefined;
  const hydrated = workersHydrated && attendanceHydrated;

  // Load existing selections whenever the selected date changes.
  useEffect(() => {
    if (!dateKey || !attendanceHydrated) return;
    const record = getRecordForDate(dateKey);
    setSelectedIds(new Set(record?.workerIds ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateKey, attendanceHydrated]);

  const activeWorkers = useMemo(() => selectActiveWorkers(workers), [workers]);
  const visibleWorkers = useMemo(
    () => searchWorkers(activeWorkers, query),
    [activeWorkers, query],
  );

  const toggle = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleSave = () => {
    if (!dateKey) return;
    // Only persist IDs of currently active workers; the database enforces one
    // row per worker per date, so nobody is counted twice.
    const valid = activeWorkers.map((w) => w.id);
    const ids = [...selectedIds].filter((id) => valid.includes(id));
    void saveAttendance(dateKey, ids)
      .then(() =>
        toast.success(
          `Attendance saved for ${format(date!, "PPP")} — ${ids.length} worker${ids.length === 1 ? "" : "s"} present.`,
        ),
      )
      .catch(() => toast.error("Could not save attendance. Please try again."));
  };

  return (
    <AppLayout>
      <PageHeader
        title="Daily Attendance"
        description="Mark which active workers are present for the selected day."
        action={
          <Button onClick={handleSave} disabled={!dateKey} className="shrink-0">
            <ClipboardCheck className="h-4 w-4" strokeWidth={2} />
            Save Attendance
          </Button>
        }
      />

      {/* Controls: date picker + search */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal sm:w-[240px]",
                !date && "text-muted-foreground",
              )}
            >
              <CalendarIcon className="h-4 w-4" />
              {date ? format(date, "PPP") : <span>Pick a date</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={date}
              onSelect={(d) => d && setDate(d)}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>

        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search workers by name…"
            className="h-10 w-full rounded-lg border border-input bg-card pl-9 pr-3 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {/* Selection summary */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
          Selected: {selectedIds.size} worker{selectedIds.size === 1 ? "" : "s"}
        </span>
        {existing && (
          <span className="text-xs text-muted-foreground">
            Attendance already saved for this date — your changes will update it.
          </span>
        )}
      </div>

      {/* Worker list */}
      <div className="mt-4 rounded-xl border border-border bg-card shadow-card">
        {!hydrated ? null : visibleWorkers.length === 0 ? (
          <div className="grid place-items-center px-5 py-14 text-center">
            <div>
              <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-accent">
                <ClipboardCheck className="h-5 w-5 text-accent-foreground" />
              </div>
              <p className="mt-3 text-sm font-medium text-foreground">
                {activeWorkers.length === 0
                  ? "No active workers"
                  : "No workers match your search"}
              </p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                {activeWorkers.length === 0
                  ? "Add workers on the Workers page before registering attendance."
                  : "Try a different name."}
              </p>
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {visibleWorkers.map((worker) => {
              const checked = selectedIds.has(worker.id);
              return (
                <li key={worker.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/50 sm:px-5">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => toggle(worker.id, v === true)}
                      aria-label={`Mark ${worker.fullName} present`}
                      className="h-5 w-5"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {worker.fullName}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {worker.phone}
                      </p>
                    </div>
                    {checked && (
                      <span className="shrink-0 rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-semibold text-success">
                        Present
                      </span>
                    )}
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Mobile save action */}
      <div className="mt-4 sm:hidden">
        <Button onClick={handleSave} disabled={!dateKey} className="w-full">
          <ClipboardCheck className="h-4 w-4" strokeWidth={2} />
          Save Attendance
        </Button>
      </div>
    </AppLayout>
  );
}
