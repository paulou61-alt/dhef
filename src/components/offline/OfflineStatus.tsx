"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, CloudOff, RefreshCw, TriangleAlert } from "lucide-react";
import { listOfflineOperations, setOfflineIdentity } from "@/lib/offline/db";
import { syncAllOfflineOperations } from "@/lib/offline/sync";

export function OfflineStatus({ userId }: { userId: string }) {
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [failed, setFailed] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const operations = await listOfflineOperations();
      setPending(operations.filter((op) => op.status === "pending").length);
      setFailed(operations.filter((op) => op.status === "failed").length);
    } catch {
      setPending(0);
      setFailed(0);
    }
  }, []);

  const sync = useCallback(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    setSyncing(true);
    try {
      await syncAllOfflineOperations();
      await refresh();
    } finally {
      setSyncing(false);
    }
  }, [refresh]);

  useEffect(() => {
    setOnline(navigator.onLine);
    void setOfflineIdentity(userId).then(refresh);

    if (navigator.storage?.persist) {
      void navigator.storage.persist().catch(() => false);
    }

    const handleOnline = () => {
      setOnline(true);
      void sync();
    };
    const handleOffline = () => setOnline(false);
    const handleChange = () => void refresh();
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && navigator.onLine) void sync();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("sacoleiro:offline-change", handleChange as EventListener);
    document.addEventListener("visibilitychange", handleVisibility);

    const timer = window.setInterval(() => {
      if (navigator.onLine) void sync();
    }, 30000);

    if (navigator.onLine) void sync();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("sacoleiro:offline-change", handleChange as EventListener);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.clearInterval(timer);
    };
  }, [refresh, sync, userId]);

  const total = pending + failed;

  let icon = <CheckCircle2 size={14} />;
  let label = "Online · sincronizado";
  let className = "border-emerald-200 bg-emerald-50 text-emerald-700";

  if (!online) {
    icon = <CloudOff size={14} />;
    label = `Offline${total ? ` · ${total} pendência${total === 1 ? "" : "s"}` : ""}`;
    className = "border-amber-200 bg-amber-50 text-amber-700";
  } else if (failed > 0) {
    icon = <TriangleAlert size={14} />;
    label = `${failed} pendência${failed === 1 ? "" : "s"} com atenção`;
    className = "border-rose-200 bg-rose-50 text-rose-700";
  } else if (syncing || pending > 0) {
    icon = <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />;
    label = syncing ? `Sincronizando${pending ? ` ${pending}` : ""}...` : `${pending} aguardando sincronização`;
    className = "border-blue-200 bg-blue-50 text-blue-700";
  }

  return (
    <div className="pointer-events-none fixed right-3 top-[4.35rem] z-40 md:right-6 md:top-5">
      <Link
        href="/offline"
        className={`pointer-events-auto inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold shadow-sm backdrop-blur ${className}`}
      >
        {icon}
        {label}
      </Link>
    </div>
  );
}
