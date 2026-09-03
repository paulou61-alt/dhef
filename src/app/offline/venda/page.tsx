"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, CloudOff, Database } from "lucide-react";
import { SaleForm } from "@/components/sales/SaleForm";
import { getOfflineBootstrap, type OfflineBootstrap } from "@/lib/offline/bootstrap";

export default function OfflineSalePage() {
  const [snapshot, setSnapshot] = useState<OfflineBootstrap | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void getOfflineBootstrap().then((data) => {
      setSnapshot(data);
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  return (
    <main className="min-h-dvh bg-slate-50 px-4 py-6 text-slate-900">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/offline" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600"><ArrowLeft size={17} /> Central offline</Link>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700"><CloudOff size={14} /> Venda offline</span>
        </div>

        <div>
          <h1 className="text-2xl font-black tracking-tight">Nova venda offline</h1>
          <p className="mt-1 text-sm text-slate-500">Usa a última cópia local de clientes, produtos, preços e estoque.</p>
        </div>

        {!loaded ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Carregando dados salvos no aparelho...</div>
        ) : !snapshot ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
            <div className="flex items-center gap-2 font-bold"><Database size={18} /> Ainda não existe uma cópia offline</div>
            <p className="mt-2 text-sm leading-6">Conecte o aparelho à internet, entre no sistema e aguarde aparecer “Online · sincronizado”. Depois disso, os dados necessários para venda offline ficam salvos automaticamente.</p>
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-800">
              Dados atualizados em {new Date(snapshot.cachedAt).toLocaleString("pt-BR")}. O estoque exibido é a última posição sincronizada e pode ter mudado em outro aparelho.
            </div>
            <SaleForm customers={snapshot.customers} products={snapshot.products} variants={snapshot.variants} />
          </>
        )}
      </div>
    </main>
  );
}
