"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CloudOff, Database } from "lucide-react";
import { ReceiveButton } from "@/components/finance/ReceiveButton";
import { getOfflineBootstrap, type OfflineBootstrap } from "@/lib/offline/bootstrap";
import { formatCurrency, formatDate } from "@/utils/format";

export default function OfflineReceivePage() {
  const [snapshot, setSnapshot] = useState<OfflineBootstrap | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void getOfflineBootstrap().then((data) => {
      setSnapshot(data);
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  const installments = useMemo(() => snapshot?.installments ?? [], [snapshot]);

  return (
    <main className="min-h-dvh bg-slate-50 px-4 py-6 text-slate-900">
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/offline" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600"><ArrowLeft size={17} /> Central offline</Link>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700"><CloudOff size={14} /> Receber offline</span>
        </div>

        <div>
          <h1 className="text-2xl font-black tracking-tight">Registrar recebimento offline</h1>
          <p className="mt-1 text-sm text-slate-500">Parcelas abertas da última sincronização feita neste aparelho.</p>
        </div>

        {!loaded ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Carregando dados salvos no aparelho...</div>
        ) : !snapshot ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
            <div className="flex items-center gap-2 font-bold"><Database size={18} /> Ainda não existe uma cópia offline</div>
            <p className="mt-2 text-sm">Abra o sistema conectado à internet uma vez para baixar os dados de clientes e parcelas.</p>
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-800">Dados atualizados em {new Date(snapshot.cachedAt).toLocaleString("pt-BR")}.</div>
            {installments.length === 0 ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm font-semibold text-emerald-800">Nenhuma parcela em aberto na última sincronização.</div>
            ) : (
              <div className="space-y-3">
                {installments.map((item) => {
                  const openAmount = Math.max(0, Number(item.amount) - Number(item.paid_amount ?? 0));
                  const customer = item.sales?.customers?.name ?? "Cliente";
                  return (
                    <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-slate-900">{customer}</p>
                          <p className="mt-1 text-xs text-slate-500">Venda #{item.sales?.sale_number ?? "-"} · Vence {formatDate(item.due_date)}</p>
                          <p className="mt-2 text-lg font-black text-slate-900">{formatCurrency(openAmount)}</p>
                        </div>
                        <ReceiveButton installmentId={item.id} openAmount={openAmount} buttonLabel="Receber" />
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
