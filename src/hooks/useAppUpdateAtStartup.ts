import { useEffect, useState } from "react";
import { checkForAppUpdateOnceAtStartup, type PendingAppUpdate } from "@/lib/appUpdater";

export function useAppUpdateAtStartup() {
  const [pendingUpdate, setPendingUpdate] = useState<PendingAppUpdate | null>(null);

  useEffect(() => {
    let cancelled = false;
    void checkForAppUpdateOnceAtStartup().then((pending) => {
      if (!cancelled && pending) setPendingUpdate(pending);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    pendingUpdate,
    dismissPendingUpdate: () => setPendingUpdate(null),
  };
}
