"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, PencilLine, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { deletePayment, updatePaymentAmount } from "@/app/(app)/clientes/actions";
import { formatCurrency, formatDate } from "@/utils/format";

function parseAmount(value: string): number {
  const normalized = value.includes(",")
    ? value.replace(/\./g, "").replace(",", ".")
    : value;
  return Number(normalized);
}

export function PaymentAmountEditor({
  paymentId,
  amount,
  paymentDate,
  paymentMethod,
}: {
  paymentId: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(amount.toFixed(2).replace(".", ","));
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!editing) setValue(amount.toFixed(2).replace(".", ","));
  }, [amount, editing]);

  function save() {
    const nextAmount = parseAmount(value);
    if (!Number.isFinite(nextAmount) || nextAmount <= 0) {
      setError("Informe um valor maior que zero.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await updatePaymentAmount({
        paymentId,
        amount: nextAmount,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      setEditing(false);
      router.refresh();
    });
  }

  function remove() {
    setError(null);
    startTransition(async () => {
      const result = await deletePayment({ paymentId });
      if (result.error) {
        setError(result.error);
        return;
      }
      setConfirmingDelete(false);
      router.refresh();
    });
  }

  if (!editing) {
    return (
      <div className="mt-2 border-t border-slate-200 pt-2">
        <p className="text-xs text-success">
          Recebido {formatCurrency(amount)} em {formatDate(paymentDate)} via {paymentMethod}
        </p>
        <button
          type="button"
          onClick={() => { setEditing(true); setError(null); }}
          className="mt-1 inline-flex items-center gap-1 rounded-lg bg-brand-50 px-2 py-1 text-[11px] font-semibold text-brand-600"
        >
          <PencilLine size={11} />
          Editar valor
        </button>
        <button
          type="button"
          onClick={() => { setConfirmingDelete(true); setError(null); }}
          className="ml-1.5 mt-1 inline-flex items-center gap-1 rounded-lg bg-red-50 px-2 py-1 text-[11px] font-semibold text-danger"
        >
          <Trash2 size={11} />
          Excluir
        </button>
        {confirmingDelete && (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2">
            <p className="text-[11px] font-semibold text-red-700">
              Excluir este recebimento de {formatCurrency(amount)}? A parcela volta a ficar em aberto.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                disabled={pending}
                className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={remove}
                disabled={pending}
                className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50"
              >
                <Trash2 size={12} /> {pending ? "Excluindo..." : "Excluir"}
              </button>
            </div>
          </div>
        )}
        {error && <p className="mt-1 text-[11px] font-medium text-danger">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mt-2 border-t border-slate-200 pt-2">
      <div className="flex max-w-sm items-center gap-2">
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="input-field !h-9 min-w-0 flex-1 !py-1.5 text-xs"
          autoFocus
          aria-label="Novo valor recebido"
        />
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-brand-600 text-white disabled:opacity-50"
          aria-label="Salvar novo valor"
        >
          <Check size={15} />
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setValue(amount.toFixed(2).replace(".", ","));
            setError(null);
          }}
          disabled={pending}
          className="flex h-9 w-9 flex-none items-center justify-center rounded-lg border border-slate-200 text-slate-500"
          aria-label="Cancelar edição"
        >
          <X size={15} />
        </button>
      </div>
      {error && <p className="mt-1 text-[11px] font-medium text-danger">{error}</p>}
    </div>
  );
}
