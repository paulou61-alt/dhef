"use client";

import { useState, useTransition } from "react";
import { registerPayment } from "@/app/(app)/receber/actions";
import { formatCurrency } from "@/utils/format";

export function ReceiveButton({ installmentId, openAmount }: { installmentId: string; openAmount: number }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(openAmount.toFixed(2)).replace(".", ","));
  const [method, setMethod] = useState<"pix" | "dinheiro" | "cartao">("pix");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await registerPayment({
        installmentId,
        amount: Number(amount.replace(",", ".")),
        paymentMethod: method,
        paymentDate: date,
        notes,
      });
      if (result.error) return setError(result.error);
      setOpen(false);
      window.location.reload();
    });
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="rounded-xl bg-brand-500 px-3 py-2 text-xs font-semibold text-white">
        Receber
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-floating sm:rounded-2xl">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-slate-900">Registrar recebimento</h2>
              <p className="text-sm text-slate-500">Saldo atual: {formatCurrency(openAmount)}</p>
            </div>
            <div className="space-y-3">
              <div><label className="label">Valor recebido</label><input className="input-field" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
              <div><label className="label">Forma</label><select className="input-field" value={method} onChange={(e) => setMethod(e.target.value as any)}><option value="pix">Pix</option><option value="dinheiro">Dinheiro</option><option value="cartao">Cartão</option></select></div>
              <div><label className="label">Data</label><input className="input-field" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
              <div><label className="label">Observação</label><input className="input-field" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" /></div>
              {error && <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button type="button" onClick={() => setOpen(false)} className="btn-secondary">Cancelar</button>
                <button type="button" disabled={pending} onClick={submit} className="btn-primary">{pending ? "Salvando..." : "Confirmar"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
