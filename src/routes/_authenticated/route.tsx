import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { migrateLocalDataToCloud } from "@/lib/local-migration";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  // One-time, duplicate-safe import of any data still held in this browser.
  useEffect(() => {
    migrateLocalDataToCloud()
      .then((imported) => {
        if (imported > 0) {
          toast.success(`Imported ${imported} worker${imported === 1 ? "" : "s"} from this device.`);
        }
      })
      .catch(() => {
        /* migration is best-effort; the app still works without it */
      });
  }, []);

  return <Outlet />;
}
