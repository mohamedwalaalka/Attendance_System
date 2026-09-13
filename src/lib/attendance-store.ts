import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * One attendance record per date: a set of unique Worker IDs marked present.
 */
export interface AttendanceRecord {
  /** ISO date string, e.g. "2026-08-30". */
  date: string;

  /** Unique worker IDs marked present on this date. No duplicates. */
  workerIds: string[];

  savedAt: string;
}

/**
 * Local-date ISO key (YYYY-MM-DD) — used as the record key per day.
 */
export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");

  return `${y}-${m}-${d}`;
}

let cache: AttendanceRecord[] = [];

/**
 * Latest raw attendance rows, newest first (for Recent Activity).
 */
let recentCache: {
  workerId: string;
  date: string;
  savedAt: string;
}[] = [];

let loaded = false;
let inFlight: Promise<void> | null = null;

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

export async function refreshAttendance(): Promise<void> {
  const { data, error } = await supabase
    .from("attendance")
    .select("worker_id, attendance_date, created_at");

  if (error) {
    throw error;
  }

  const byDate = new Map<
    string,
    {
      ids: Set<string>;
      savedAt: string;
    }
  >();

  for (const row of (data ?? []) as {
    worker_id: string;
    attendance_date: string;
    created_at: string;
  }[]) {
    const entry = byDate.get(row.attendance_date) ?? {
      ids: new Set<string>(),
      savedAt: row.created_at,
    };

    entry.ids.add(row.worker_id);

    if (row.created_at > entry.savedAt) {
      entry.savedAt = row.created_at;
    }

    byDate.set(row.attendance_date, entry);
  }

  cache = [...byDate.entries()]
    .map(([date, entry]) => ({
      date,
      workerIds: [...entry.ids],
      savedAt: entry.savedAt,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  recentCache = ((data ?? []) as {
    worker_id: string;
    attendance_date: string;
    created_at: string;
  }[])
    .map((row) => ({
      workerId: row.worker_id,
      date: row.attendance_date,
      savedAt: row.created_at,
    }))
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt))
    .slice(0, 10);

  loaded = true;
  notify();
}

function ensureLoaded(): Promise<void> {
  if (!inFlight) {
    inFlight = refreshAttendance().finally(() => {
      inFlight = null;
    });
  }

  return inFlight;
}

export function useAttendance() {
  const [records, setRecords] = useState<AttendanceRecord[]>(cache);
  const [recent, setRecent] = useState(recentCache);
  const [hydrated, setHydrated] = useState(loaded);

  const sync = useCallback(() => {
    setRecords(cache);
    setRecent(recentCache);
    setHydrated(loaded);
  }, []);

  useEffect(() => {
    listeners.add(sync);

    sync();

    void ensureLoaded()
      .then(sync)
      .catch(() => setHydrated(true));

    return () => {
      listeners.delete(sync);
    };
  }, [sync]);

  /**
   * Save (or replace) the present worker IDs for a date.
   *
   * The database enforces one row per worker per date, so a worker
   * can never be counted twice on the same day.
   */
  const saveAttendance = useCallback(
    async (date: string, workerIds: string[]) => {
      const unique = [...new Set(workerIds)];

      const { data: existingRows, error: readError } = await supabase
        .from("attendance")
        .select("worker_id")
        .eq("attendance_date", date);

      if (readError) {
        throw new Error(readError.message);
      }

      const existing = new Set(
        ((existingRows ?? []) as { worker_id: string }[]).map(
          (r) => r.worker_id,
        ),
      );

      const toRemove = [...existing].filter(
        (id) => !unique.includes(id),
      );

      const toAdd = unique.filter(
        (id) => !existing.has(id),
      );

      if (toRemove.length > 0) {
        const { error } = await supabase
          .from("attendance")
          .delete()
          .eq("attendance_date", date)
          .in("worker_id", toRemove);

        if (error) {
          throw new Error(error.message);
        }
      }

      if (toAdd.length > 0) {
        const { error } = await supabase
          .from("attendance")
          .upsert(
            toAdd.map((worker_id) => ({
              worker_id,
              attendance_date: date,
            })),
            {
              onConflict: "worker_id,attendance_date",
            },
          );

        if (error) {
          throw new Error(error.message);
        }
      }

      await refreshAttendance();
    },
    [],
  );

  const getRecordForDate = useCallback(
    (date: string): AttendanceRecord | undefined =>
      records.find((r) => r.date === date),
    [records],
  );

  return {
    records,
    recent,
    hydrated,
    saveAttendance,
    getRecordForDate,
  };
}

/**
 * Present-worker count for a date — lets the Dashboard read "Worked Today".
 */
export function countPresentOn(
  records: AttendanceRecord[],
  date: string,
): number {
  return (
    records.find((r) => r.date === date)?.workerIds.length ?? 0
  );
}

/**
 * Total attendance records (worker-days) within a calendar month.
 */
export function countInMonth(
  records: AttendanceRecord[],
  year: number,
  monthIndex: number,
): number {
  const prefix = `${year}-${String(monthIndex + 1).padStart(2, "0")}-`;

  return records
    .filter((r) => r.date.startsWith(prefix))
    .reduce(
      (sum, r) => sum + r.workerIds.length,
      0,
    );
}