"use client";

import { useState, useTransition } from "react";
import { CloudOff } from "lucide-react";
import { submitOfflineCapableOperation } from "@/lib/offline/sync";
import { formatCurrency } from "@/utils/format";

export function ReceiveButton({ installmentId, openAmount, buttonLabel = "Receber" }: { installmentId: string; openAmount: number; buttonLabel?: string }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(openAmount.toFixed(2)).replace(".", ","));
  const [method, setMethod] = useState<"pix" | "dinheiro" | "cartao">("pix");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      try {
        const result = await submitOfflineCapableOperation("payment", {
          installmentId,
          amount: Number(amount.replace(",", ".")),
          paymentMethod: method,
          paymentDate: date,
          notes,
        });

        if (result.synced) {
          setOpen(false);
          window.location.reload();
          return;
        }

        if (result.queued) {
          setOpen(false);
          setNotice(result.error
            ? `Recebimento salvo no aparelho, mas precisa de atenção: ${result.error}`
            : "Recebimento salvo offline. Será sincronizado automaticamente quando a internet voltar.");
          return;
        }

        setError(result.error ?? "Não foi possível registrar o recebimento.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não foi possível salvar o recebimento offline.");
      }
    });
  }

  return (
    <>
      <div className="flex flex-col items-end gap-1.5">
        <button type="button" onClick={() => setOpen(true)} className="rounded-xl bg-brand-500 px-3 py-2 text-xs font-semibold text-white">{buttonLabel}</button>
        {notice && <span className="max-w-[220px] rounded-lg bg-amber-50 px-2 py-1 text-right text-[10px] font-medium text-amber-800"><CloudOff size={11} className="mr-1 inline" />{notice}</span>}
      </div>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-floating sm:rounded-2xl">
            <div className="mb-4"><h2 className="text-lg font-bold text-slate-900">Registrar recebimento</h2><p className="text-sm text-slate-500">Saldo atual: {formatCurrency(openAmount)}</p></div>
            <div className="space-y-3">
              <div><label className="label">Valor recebido</label><input className="input-field" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
              <div><label className="label">Forma</label><select className="input-field" value={method} onChange={(e) => setMethod(e.target.value as any)}><option value="pix">Pix</option><option value="dinheiro">Dinheiro</option><option value="cartao">Cartão</option></select></div>
              <div><label className="label">Data</label><input className="input-field" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
              <div><label className="label">Observação</label><input className="input-field" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" /></div>
              {error && <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
              <div className="grid grid-cols-2 gap-2 pt-1"><button type="button" onClick={() => setOpen(false)} className="btn-secondary">Cancelar</button><button type="button" disabled={pending} onClick={submit} className="btn-primary">{pending ? "Salvando..." : "Confirmar"}</button></div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
