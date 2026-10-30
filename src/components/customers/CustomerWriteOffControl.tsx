"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, RotateCcw, Truck } from "lucide-react";
import { setCustomerWriteOff } from "@/app/(app)/clientes/actions";
import { formatCurrency, formatDate } from "@/utils/format";

const LABELS = { prego: "Prego (não paga)", mudou: "Mudou" } as const;

// Tira o cliente das cobranças (prego ou mudou) mesmo com dívida, liberando a ficha. Também reativa.
export function CustomerWriteOffControl({
  customerId,
  status,
  markedAt,
  note,
  openAmount,
}: {
  customerId: string;
  status: "prego" | "mudou" | null;
  markedAt: string | null;
  note: string | null;
  openAmount: number;
}) {
  const router = useRouter();
  const [choice, setChoice] = useState<"prego" | "mudou" | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save(next: "prego" | "mudou" | null) {
    setError(null);
    startTransition(async () => {
      const result = await setCustomerWriteOff({ customerId, status: next, note: text });
      if (result.error) return setError(result.error);
      setChoice(null);
      setText("");
      router.refresh();
    });
  }

  if (status) {
    return (
      <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-bold text-red-700">
              Cliente marcado como {status === "prego" ? "PREGO" : "MUDOU"}
              {markedAt ? <span className="font-normal text-red-600"> · desde {formatDate(markedAt)}</span> : null}
            </p>
            <p className="text-xs text-red-600">
              Fora das cobranças e com a ficha liberada.{openAmount > 0 ? ` Dívida que ficou: ${formatCurrency(openAmount)}.` : ""}
              {note ? ` Obs.: ${note}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={() => save(null)}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-50"
          >
            <RotateCcw size={14} /> {pending ? "Reativando..." : "Reativar cliente"}
          </button>
        </div>
        {error && <p className="mt-2 text-xs font-medium text-danger">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mt-4">
      {!choice ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setChoice("prego")} className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50">
            <Ban size={14} /> Marcar como prego
          </button>
          <button type="button" onClick={() => setChoice("mudou")} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
            <Truck size={14} /> Marcar como mudou
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3">
          <p className="text-sm font-bold text-red-700">Marcar como {LABELS[choice]}?</p>
          <p className="mt-0.5 text-xs text-red-600">
            O cliente sai de Receber e Cobranças e a ficha fica disponível para outro cliente.
            {openAmount > 0 ? ` A dívida de ${formatCurrency(openAmount)} continua registrada nesta ficha.` : ""} Dá para reativar depois.
          </p>
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={240}
            className="input-field mt-2 bg-white"
            placeholder={choice === "mudou" ? "Observação (ex.: mudou para outra cidade)" : "Observação (opcional)"}
          />
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" onClick={() => { setChoice(null); setError(null); }} disabled={pending} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">
              Cancelar
            </button>
            <button type="button" onClick={() => save(choice)} disabled={pending} className="rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
              {pending ? "Salvando..." : "Confirmar"}
            </button>
          </div>
          {error && <p className="mt-2 text-xs font-medium text-danger">{error}</p>}
        </div>
      )}
    </div>
  );
}
