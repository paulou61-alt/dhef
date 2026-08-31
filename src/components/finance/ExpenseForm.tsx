"use client";

import { useState, useTransition } from "react";
import { registerExpense } from "@/app/(app)/despesas/actions";

export function ExpenseForm() {
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("outros");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await registerExpense({
        description,
        category,
        amount: Number(amount.replace(",", ".")),
        expenseDate: date,
        notes,
      });
      if (result.error) return setError(result.error);
      setDescription(""); setAmount(""); setNotes("");
      window.location.reload();
    });
  }

  return (
    <div className="card space-y-3">
      <h2 className="text-[15px] font-bold text-slate-900">Nova despesa</h2>
      <div><label className="label">Descrição</label><input className="input-field" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex.: combustível, embalagem..." /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Categoria</label><select className="input-field" value={category} onChange={(e) => setCategory(e.target.value)}><option value="mercadoria">Mercadoria</option><option value="transporte">Transporte</option><option value="embalagem">Embalagem</option><option value="alimentacao">Alimentação</option><option value="taxas">Taxas</option><option value="outros">Outros</option></select></div>
        <div><label className="label">Valor</label><input className="input-field" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" /></div>
      </div>
      <div><label className="label">Data</label><input className="input-field" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      <div><label className="label">Observações</label><textarea className="input-field min-h-20" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
      {error && <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
      <button type="button" className="btn-primary w-full" disabled={pending} onClick={submit}>{pending ? "Salvando..." : "Lançar despesa"}</button>
    </div>
  );
}
