"use client";

import Link from "next/link";
import { ArrowLeft, CloudOff } from "lucide-react";
import { ExpenseForm } from "@/components/finance/ExpenseForm";

export default function OfflineExpensePage() {
  return (
    <main className="min-h-dvh bg-slate-50 px-4 py-6 text-slate-900">
      <div className="mx-auto max-w-xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/offline" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600"><ArrowLeft size={17} /> Central offline</Link>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700"><CloudOff size={14} /> Despesa offline</span>
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tight">Nova despesa offline</h1>
          <p className="mt-1 text-sm text-slate-500">O lançamento fica salvo neste aparelho até a conexão voltar.</p>
        </div>
        <ExpenseForm />
      </div>
    </main>
  );
}
