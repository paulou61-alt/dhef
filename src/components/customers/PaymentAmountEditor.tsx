"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, PencilLine, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { updatePaymentAmount } from "@/app/(app)/clientes/actions";
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
