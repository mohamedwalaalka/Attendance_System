import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Worker, WorkerInput } from "@/lib/workers-store";

type Errors = Partial<Record<"fullName" | "phone" | "dailyWage", string>>;

export function WorkerFormDialog({
  open,
  onOpenChange,
  worker,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  worker: Worker | null;
  /** Return an error message to keep the dialog open and show it on the phone field. */
  onSubmit: (input: WorkerInput) => string | void;
}) {

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [dailyWage, setDailyWage] = useState("");
  const [errors, setErrors] = useState<Errors>({});

  useEffect(() => {
    if (!open) return;
    setFullName(worker?.fullName ?? "");
    setPhone(worker?.phone ?? "");
    setDailyWage(worker?.dailyWage != null ? String(worker.dailyWage) : "");
    setErrors({});
  }, [open, worker]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors: Errors = {};
    const name = fullName.trim();
    const phoneValue = phone.trim();
    const wageRaw = dailyWage.trim();

    if (!name) nextErrors.fullName = "Full name is required.";
    else if (name.length > 100) nextErrors.fullName = "Name must be under 100 characters.";

    // Updated validation: Must be exactly 9 numeric digits
    if (!phoneValue) {
      nextErrors.phone = "Phone number is required.";
    } else if (!/^\d{9}$/.test(phoneValue)) {
      nextErrors.phone = "Phone number must be exactly 9 digits.";
    }

    let wage: number | null = null;
    if (wageRaw) {
      const parsed = Number(wageRaw);
      if (!Number.isFinite(parsed) || parsed < 0) nextErrors.dailyWage = "Enter a valid amount.";
      else wage = parsed;
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const error = onSubmit({ fullName: name, phone: phoneValue, dailyWage: wage });
    if (error) setErrors({ phone: error });
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{worker ? "Edit Worker" : "Add Worker"}</DialogTitle>
          <DialogDescription>
            {worker
              ? "Update this worker's details. Their internal ID stays the same."
              : "Add a new worker to your workforce."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="worker-name">
              Full Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="worker-name"
              value={fullName}
              maxLength={100}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Ahmed Hassan"
              autoComplete="off"
            />
            {errors.fullName && <p className="text-xs text-destructive">{errors.fullName}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="worker-phone">
              Phone Number <span className="text-destructive">*</span>
            </Label>
            <Input
              id="worker-phone"
              value={phone}
              maxLength={9}
              inputMode="numeric"
              onChange={(e) => {
                // Strips all non-digit characters and limits input to 9 digits
                const cleanInput = e.target.value.replace(/\D/g, "").slice(0, 9);
                setPhone(cleanInput);
              }}
              placeholder="e.g. 614244808"
              autoComplete="off"
            />
            {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="worker-wage">
              Daily Wage <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="worker-wage"
              value={dailyWage}
              inputMode="decimal"
              onChange={(e) => setDailyWage(e.target.value)}
              placeholder="e.g. 10"
              autoComplete="off"
            />
            {errors.dailyWage && <p className="text-xs text-destructive">{errors.dailyWage}</p>}
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">{worker ? "Save Changes" : "Add Worker"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}