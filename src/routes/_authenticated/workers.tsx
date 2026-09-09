import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Pencil, Plus, Search, Trash2, UserCheck, UserX, Users } from "lucide-react";
import { toast } from "sonner";
import { AppLayout, PageHeader } from "@/components/app-layout";
import { WorkerFormDialog } from "@/components/worker-form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  DUPLICATE_PHONE_MESSAGE,
  formatWage,
  isPhoneTaken,
  searchWorkers,
  useWorkers,
  type Worker,
  type WorkerInput,
} from "@/lib/workers-store";


export const Route = createFileRoute("/_authenticated/workers")({
  head: () => ({
    meta: [
      { title: "Workers — Worker Attendance Management" },
      {
        name: "description",
        content: "Manage your workforce: add, edit, search, and organize worker records.",
      },
      { property: "og:title", content: "Workers — Worker Attendance Management" },
      {
        property: "og:description",
        content: "Manage your workforce: add, edit, search, and organize worker records.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: WorkersPage,
});

function StatusBadge({ status }: { status: Worker["status"] }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        status === "active"
          ? "bg-success/10 text-success"
          : "bg-muted text-muted-foreground",
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          status === "active" ? "bg-success" : "bg-muted-foreground",
        )}
      />
      {status === "active" ? "Active" : "Inactive"}
    </span>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="grid place-items-center px-5 py-16 text-center">
      <div>
        <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-accent">
          <Users className="h-5 w-5 text-accent-foreground" />
        </div>
        <p className="mt-3 text-sm font-medium text-foreground">{title}</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function WorkersPage() {
  const { workers, hydrated, addWorker, updateWorker, setWorkerStatus, deleteWorker } =
    useWorkers();
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Worker | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Worker | null>(null);

  const filtered = useMemo(() => searchWorkers(workers, query), [workers, query]);

  const handleSubmit = (input: WorkerInput): string | void => {
    if (isPhoneTaken(workers, input.phone, editing?.id ?? null)) {
      return DUPLICATE_PHONE_MESSAGE;
    }
    const target = editing;
    const run = target ? updateWorker(target.id, input) : addWorker(input);
    void run
      .then(() => {
        toast.success(
          target
            ? `${input.fullName} updated.`
            : `${input.fullName} added to your workforce.`,
        );
      })
      .catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : "Could not save this worker.");
      });
    setFormOpen(false);
    setEditing(null);
  };


  const toggleStatus = (worker: Worker) => {
    const next = worker.status === "active" ? "inactive" : "active";
    void setWorkerStatus(worker.id, next)
      .then(() =>
        toast.success(
          next === "active" ? `${worker.fullName} activated.` : `${worker.fullName} deactivated.`,
        ),
      )
      .catch(() => toast.error("Could not update this worker's status."));
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    const worker = pendingDelete;
    void deleteWorker(worker.id)
      .then(() => toast.success(`${worker.fullName} deleted.`))
      .catch(() => toast.error("Could not delete this worker."));
    setPendingDelete(null);
  };

  const showEmpty = hydrated && workers.length === 0;
  const showNoResults = hydrated && workers.length > 0 && filtered.length === 0;

  return (
    <AppLayout>
      <PageHeader
        title="Workers"
        description="View and manage all registered workers."
        action={
          <Button
            type="button"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            className="h-9 shrink-0 gap-2"
          >
            <Plus className="h-4 w-4" />
            <span>Add Worker</span>
          </Button>
        }
      />

      <div className="mt-5">
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or phone number"
            className="pl-9"
            aria-label="Search workers"
          />
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-border bg-card shadow-card">
        {showEmpty ? (
          <EmptyState
            title="No workers yet"
            description="Add your first worker to start tracking daily attendance."
          />
        ) : showNoResults ? (
          <EmptyState
            title="No matching workers"
            description="No worker matches that name or phone number. Try a different search."
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Worker Name</TableHead>
                    <TableHead>Phone Number</TableHead>
                    <TableHead>Daily Wage</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((worker) => (
                    <TableRow key={worker.id}>
                      <TableCell className="font-medium text-foreground">
                        {worker.fullName}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{worker.phone}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatWage(worker.dailyWage)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={worker.status} />
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Edit ${worker.fullName}`}
                            onClick={() => {
                              setEditing(worker);
                              setFormOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={
                              worker.status === "active"
                                ? `Deactivate ${worker.fullName}`
                                : `Activate ${worker.fullName}`
                            }
                            onClick={() => toggleStatus(worker)}
                          >
                            {worker.status === "active" ? (
                              <UserX className="h-4 w-4" />
                            ) : (
                              <UserCheck className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Delete ${worker.fullName}`}
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setPendingDelete(worker)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile cards */}
            <div className="divide-y divide-border md:hidden">
              {filtered.map((worker) => (
                <div key={worker.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {worker.fullName}
                      </p>
                      <p className="mt-0.5 text-sm text-muted-foreground">{worker.phone}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Daily wage: {formatWage(worker.dailyWage)}
                      </p>
                    </div>
                    <StatusBadge status={worker.status} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => {
                        setEditing(worker);
                        setFormOpen(true);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => toggleStatus(worker)}
                    >
                      {worker.status === "active" ? (
                        <>
                          <UserX className="h-3.5 w-3.5" />
                          Deactivate
                        </>
                      ) : (
                        <>
                          <UserCheck className="h-3.5 w-3.5" />
                          Activate
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-destructive hover:text-destructive"
                      onClick={() => setPendingDelete(worker)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <WorkerFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditing(null);
        }}
        worker={editing}
        onSubmit={handleSubmit}
      />

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this worker?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete
                ? `${pendingDelete.fullName} will be permanently removed. This cannot be undone. To keep their record, deactivate them instead.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
