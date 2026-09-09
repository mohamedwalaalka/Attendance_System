import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type WorkerStatus = "active" | "inactive";

export interface Worker {
  /** Unique internal ID from the database — never derived from the worker's name. */
  id: string;
  fullName: string;
  phone: string;
  /** Optional daily wage. */
  dailyWage: number | null;
  status: WorkerStatus;
  createdAt: string;
}

export type WorkerInput = {
  fullName: string;
  phone: string;
  dailyWage: number | null;
};

export const DUPLICATE_PHONE_MESSAGE = "A worker with this phone number already exists.";

type Row = {
  id: string;
  full_name: string;
  phone: string;
  daily_wage: number | string | null;
  status: string;
  created_at: string;
};

function mapRow(row: Row): Worker {
  return {
    id: row.id,
    fullName: row.full_name,
    phone: row.phone,
    dailyWage: row.daily_wage === null ? null : Number(row.daily_wage),
    status: row.status === "inactive" ? "inactive" : "active",
    createdAt: row.created_at,
  };
}

/** Shared cache so every mounted component stays in sync. */
let cache: Worker[] = [];
let loaded = false;
let inFlight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

export async function refreshWorkers(): Promise<void> {
  const { data, error } = await supabase
    .from("workers")
    .select("id, full_name, phone, daily_wage, status, created_at")
    .order("created_at", { ascending: true });
  if (error) throw error;
  cache = ((data ?? []) as Row[]).map(mapRow);
  loaded = true;
  notify();
}

function ensureLoaded(): Promise<void> {
  if (!inFlight) {
    inFlight = refreshWorkers().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

export function getCachedWorkers(): Worker[] {
  return cache;
}

function isUniqueViolation(error: { code?: string; message?: string }): boolean {
  return error.code === "23505" || /duplicate key/i.test(error.message ?? "");
}

export function useWorkers() {
  const [workers, setWorkers] = useState<Worker[]>(cache);
  const [hydrated, setHydrated] = useState(loaded);

  const sync = useCallback(() => {
    setWorkers(cache);
    setHydrated(loaded);
  }, []);

  useEffect(() => {
    listeners.add(sync);
    sync();
    void ensureLoaded().then(sync).catch(() => setHydrated(true));
    return () => {
      listeners.delete(sync);
    };
  }, [sync]);

  const addWorker = useCallback(async (input: WorkerInput): Promise<Worker> => {
    const { data, error } = await supabase
      .from("workers")
      .insert({
        full_name: input.fullName.trim(),
        phone: input.phone.trim(),
        daily_wage: input.dailyWage,
      })
      .select("id, full_name, phone, daily_wage, status, created_at")
      .single();
    if (error) {
      throw new Error(isUniqueViolation(error) ? DUPLICATE_PHONE_MESSAGE : error.message);
    }
    await refreshWorkers();
    return mapRow(data as Row);
  }, []);

  const updateWorker = useCallback(async (id: string, input: WorkerInput) => {
    const { error } = await supabase
      .from("workers")
      .update({
        full_name: input.fullName.trim(),
        phone: input.phone.trim(),
        daily_wage: input.dailyWage,
      })
      .eq("id", id);
    if (error) {
      throw new Error(isUniqueViolation(error) ? DUPLICATE_PHONE_MESSAGE : error.message);
    }
    await refreshWorkers();
  }, []);

  const setWorkerStatus = useCallback(async (id: string, status: WorkerStatus) => {
    const { error } = await supabase.from("workers").update({ status }).eq("id", id);
    if (error) throw new Error(error.message);
    await refreshWorkers();
  }, []);

  const deleteWorker = useCallback(async (id: string) => {
    const { error } = await supabase.from("workers").delete().eq("id", id);
    if (error) throw new Error(error.message);
    await refreshWorkers();
  }, []);

  return { workers, hydrated, addWorker, updateWorker, setWorkerStatus, deleteWorker };
}

/** Active workers only. */
export function selectActiveWorkers(workers: Worker[]): Worker[] {
  return workers.filter((w) => w.status === "active");
}

/** Strip spaces, dashes, parentheses and dots so formatting never affects comparison. */
export function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-().]/g, "");
}

/** True when another worker (not `excludeId`) already uses this phone number. */
export function isPhoneTaken(
  workers: Worker[],
  phone: string,
  excludeId?: string | null,
): boolean {
  const target = normalizePhone(phone);
  if (!target) return false;
  return workers.some((w) => w.id !== excludeId && normalizePhone(w.phone) === target);
}

export function searchWorkers(workers: Worker[], query: string): Worker[] {
  const q = query.trim().toLowerCase();
  if (!q) return workers;
  const qPhone = normalizePhone(q);
  return workers.filter(
    (w) =>
      w.fullName.toLowerCase().includes(q) ||
      (qPhone !== "" && normalizePhone(w.phone).toLowerCase().includes(qPhone)),
  );
}

export function formatWage(wage: number | null): string {
  if (wage === null) return "—";
  return `$${wage.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
