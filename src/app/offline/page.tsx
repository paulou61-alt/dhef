"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, CloudOff, CreditCard, ReceiptText, RefreshCw, ShoppingCart, Trash2, TriangleAlert } from "lucide-react";
import { listOfflineOperations, removeOfflineOperation, type OfflineOperation } from "@/lib/offline/db";
import { retryFailedOperation, syncAllOfflineOperations } from "@/lib/offline/sync";

const LABELS: Record<OfflineOperation["type"], string> = {
  sale: "Venda",
  payment: "Recebimento",
  payment_purchase: "Recebimento + compra",
  expense: "Despesa",
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("pt-BR");
}

export default function OfflinePage() {
  const [online, setOnline] = useState(true);
  const [operations, setOperations] = useState<OfflineOperation[]>([]);
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setOperations(await listOfflineOperations());
    } catch {
      setOperations([]);
    }
  }, []);

  useEffect(() => {
    setOnline(navigator.onLine);
    void refresh();
    const onOnline = () => { setOnline(true); void refresh(); };
    const onOffline = () => setOnline(false);
    const onChange = () => void refresh();
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("sacoleiro:offline-change", onChange as EventListener);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("sacoleiro:offline-change", onChange as EventListener);
    };
  }, [refresh]);

  const pending = useMemo(() => operations.filter((op) => op.status === "pending").length, [operations]);
  const failed = useMemo(() => operations.filter((op) => op.status === "failed").length, [operations]);

  async function syncAll() {
    if (!navigator.onLine) return;
    setSyncing(true);
    try {
      await syncAllOfflineOperations();
      await refresh();
    } finally {
      setSyncing(false);
    }
  }

  async function retry(id: string) {
    setSyncing(true);
    try {
      await retryFailedOperation(id);
      await refresh();
    } finally {
      setSyncing(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Remover esta pendência do aparelho? Ela não será enviada ao servidor.")) return;
    await removeOfflineOperation(id);
    await refresh();
  }

  return (
    <main className="min-h-dvh bg-slate-50 px-4 py-6 text-slate-900">
      <div className="mx-auto max-w-2xl space-y-5">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600">
            <ArrowLeft size={17} /> Voltar ao sistema
          </Link>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${online ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
            {online ? <CheckCircle2 size={14} /> : <CloudOff size={14} />}
            {online ? "Online" : "Offline"}
          </span>
        </div>

        <section className="rounded-3xl bg-slate-950 p-6 text-white shadow-xl">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Modo offline</p>
          <h1 className="mt-2 text-2xl font-black tracking-tight">Central de sincronização</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">
            Vendas, recebimentos e despesas feitos sem internet ficam salvos neste aparelho até o Supabase confirmar o envio.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-white/10 p-4"><p className="text-xs text-slate-300">Aguardando</p><p className="mt-1 text-2xl font-black">{pending}</p></div>
            <div className="rounded-2xl bg-white/10 p-4"><p className="text-xs text-slate-300">Com atenção</p><p className="mt-1 text-2xl font-black">{failed}</p></div>
            <button onClick={syncAll} disabled={!online || syncing || pending === 0} className="col-span-2 inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-950 disabled:opacity-50 sm:col-span-1">
              <RefreshCw size={16} className={syncing ? "animate-spin" : ""} />
              {syncing ? "Sincronizando" : "Sincronizar agora"}
            </button>
          </div>
        </section>

        <section>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Trabalhar sem internet</p>
          <div className="grid grid-cols-3 gap-2">
            <Link href="/offline/venda" className="rounded-2xl border border-slate-200 bg-white p-3 text-center shadow-sm"><ShoppingCart size={19} className="mx-auto text-brand-600" /><span className="mt-2 block text-xs font-bold">Nova venda</span></Link>
            <Link href="/offline/receber" className="rounded-2xl border border-slate-200 bg-white p-3 text-center shadow-sm"><CreditCard size={19} className="mx-auto text-emerald-600" /><span className="mt-2 block text-xs font-bold">Receber</span></Link>
            <Link href="/offline/despesa" className="rounded-2xl border border-slate-200 bg-white p-3 text-center shadow-sm"><ReceiptText size={19} className="mx-auto text-rose-600" /><span className="mt-2 block text-xs font-bold">Despesa</span></Link>
          </div>
        </section>

        {operations.length === 0 ? (
          <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-800">
            <div className="flex items-center gap-2 font-bold"><CheckCircle2 size={18} /> Tudo sincronizado</div>
            <p className="mt-1 text-sm">Não existe nenhuma operação pendente neste aparelho.</p>
          </section>
        ) : (
          <section className="space-y-3">
            {operations.map((operation) => (
              <article key={operation.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">{LABELS[operation.type]}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${operation.status === "failed" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"}`}>
                        {operation.status === "failed" ? "Atenção" : "Pendente"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">Criado em {formatDateTime(operation.createdAt)}</p>
                    {operation.lastError && (
                      <p className="mt-2 flex items-start gap-1.5 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">
                        <TriangleAlert size={14} className="mt-0.5 flex-none" /> {operation.lastError}
                      </p>
                    )}
                  </div>
                  <button onClick={() => remove(operation.id)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-50 hover:text-rose-600" aria-label="Remover pendência"><Trash2 size={17} /></button>
                </div>
                {operation.status === "failed" && (
                  <button onClick={() => retry(operation.id)} disabled={!online || syncing} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
                    <RefreshCw size={14} /> Tentar novamente
                  </button>
                )}
              </article>
            ))}
          </section>
        )}

        <p className="rounded-2xl border border-slate-200 bg-white p-4 text-xs leading-5 text-slate-500">
          Importante: enquanto existir pendência, não limpe os dados do navegador nem desinstale o aplicativo. Depois que aparecer “Tudo sincronizado”, os registros já foram confirmados pelo servidor.
        </p>
      </div>
    </main>
  );
}
