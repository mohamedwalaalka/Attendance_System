import { supabase } from "@/integrations/supabase/client";
import { normalizePhone, refreshWorkers } from "@/lib/workers-store";
import { refreshAttendance } from "@/lib/attendance-store";

const WORKERS_KEY = "wams.workers.v1";
const ATTENDANCE_KEY = "wams.attendance.v1";
const DONE_KEY = "wams.migrated-to-cloud.v1";

type LegacyWorker = {
  id: string;
  fullName: string;
  phone: string;
  dailyWage: number | null;
  status?: string;
};
type LegacyAttendance = { date: string; workerIds: string[] };

function readJson<T>(key: string): T[] {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

/**
 * One-time, idempotent import of any legacy browser-stored data into the database.
 * Existing rows are matched by normalized phone number so nothing is duplicated.
 */
export async function migrateLocalDataToCloud(): Promise<number> {
  if (typeof window === "undefined") return 0;
  if (window.localStorage.getItem(DONE_KEY)) return 0;

  const legacyWorkers = readJson<LegacyWorker>(WORKERS_KEY).filter(
    (w) => w && typeof w.id === "string" && typeof w.fullName === "string",
  );
  const legacyAttendance = readJson<LegacyAttendance>(ATTENDANCE_KEY).filter(
    (r) => r && typeof r.date === "string" && Array.isArray(r.workerIds),
  );

  if (legacyWorkers.length === 0 && legacyAttendance.length === 0) {
    window.localStorage.setItem(DONE_KEY, new Date().toISOString());
    return 0;
  }

  const { data: existing, error } = await supabase.from("workers").select("id, phone");
  if (error) throw new Error(error.message);

  const byPhone = new Map<string, string>();
  for (const row of (existing ?? []) as { id: string; phone: string }[]) {
    byPhone.set(normalizePhone(row.phone), row.id);
  }

  /** legacy worker id -> database worker id */
  const idMap = new Map<string, string>();
  let imported = 0;

  for (const w of legacyWorkers) {
    const key = normalizePhone(w.phone ?? "");
    const found = key ? byPhone.get(key) : undefined;
    if (found) {
      idMap.set(w.id, found);
      continue;
    }
    const { data, error: insertError } = await supabase
      .from("workers")
      .insert({
        full_name: w.fullName,
        phone: w.phone ?? "",
        daily_wage: typeof w.dailyWage === "number" ? w.dailyWage : null,
        status: w.status === "inactive" ? "inactive" : "active",
      })
      .select("id")
      .single();
    if (insertError) continue; // skip unmigratable row, keep going
    const id = (data as { id: string }).id;
    idMap.set(w.id, id);
    if (key) byPhone.set(key, id);
    imported += 1;
  }

  const attendanceRows: { worker_id: string; attendance_date: string }[] = [];
  for (const record of legacyAttendance) {
    for (const legacyId of new Set(record.workerIds)) {
      const workerId = idMap.get(legacyId);
      if (workerId) attendanceRows.push({ worker_id: workerId, attendance_date: record.date });
    }
  }

  if (attendanceRows.length > 0) {
    const { error: attendanceError } = await supabase
      .from("attendance")
      .upsert(attendanceRows, {
        onConflict: "worker_id,attendance_date",
        ignoreDuplicates: true,
      });
    if (attendanceError) throw new Error(attendanceError.message);
  }

  window.localStorage.setItem(DONE_KEY, new Date().toISOString());
  await Promise.all([refreshWorkers(), refreshAttendance()]);
  return imported;
}
