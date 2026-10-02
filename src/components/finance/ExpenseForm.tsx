"use client";

import { useState, useTransition } from "react";
import { CloudOff } from "lucide-react";
import { SelectField } from "@/components/ui/SelectField";
import { submitOfflineCapableOperation } from "@/lib/offline/sync";
import { todayInBrazil } from "@/utils/format";

const EXPENSE_CATEGORIES = [
  { value: "mercadoria", label: "Mercadoria" },
  { value: "transporte", label: "Transporte" },
  { value: "embalagem", label: "Embalagem" },
  { value: "alimentacao", label: "Alimentação" },
  { value: "taxas", label: "Taxas" },
  { value: "outros", label: "Outros" },
];

export function ExpenseForm() {
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("outros");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => todayInBrazil());
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function resetForm() {
    setDescription("");
    setAmount("");
    setNotes("");
  }

  function submit() {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      try {
        const result = await submitOfflineCapableOperation("expense", {
          description,
          category,
          amount: Number(amount.replace(",", ".")),
          expenseDate: date,
          notes,
        });

        if (result.synced) {
          resetForm();
          window.location.reload();
          return;
        }

        if (result.queued) {
          resetForm();
          setNotice(result.error
            ? `Despesa salva no aparelho, mas precisa de atenção: ${result.error}`
            : "Despesa salva offline. Será sincronizada automaticamente quando a internet voltar.");
          return;
        }

        setError(result.error ?? "Não foi possível lançar a despesa.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não foi possível salvar a despesa offline.");
      }
    });
  }

  return (
    <div className="card space-y-3">
      <h2 className="text-[15px] font-bold text-slate-900">Nova despesa</h2>
      <div><label className="label">Descrição</label><input className="input-field" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex.: combustível, embalagem..." /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Categoria</label><SelectField value={category} onChange={setCategory} options={EXPENSE_CATEGORIES} /></div>
        <div><label className="label">Valor</label><input className="input-field" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" /></div>
      </div>
      <div><label className="label">Data</label><input className="input-field" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      <div><label className="label">Observações</label><textarea className="input-field min-h-20" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
      {notice && <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800"><CloudOff size={16} className="mt-0.5 flex-none" />{notice}</p>}
      {error && <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
      <button type="button" className="btn-primary w-full" disabled={pending || !description.trim() || !amount} onClick={submit}>{pending ? "Salvando..." : "Lançar despesa"}</button>
    </div>
  );
}
