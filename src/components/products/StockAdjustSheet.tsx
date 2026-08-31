"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { adjustStock } from "@/app/(app)/estoque/actions";

export function StockAdjustSheet({
  variantId,
  variantLabel,
  onClose,
}: {
  variantId: string;
  variantLabel: string;
  onClose: () => void;
}) {
  const [type, setType] = useState<"entrada" | "saida" | "ajuste">("entrada");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await adjustStock(variantId, type, parseInt(quantity, 10) || 0, reason);
      if (result?.error) {
        setError(result.error);
      } else {
        onClose();
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-t-2xl bg-white p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] md:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[15px] font-bold text-slate-900">{variantLabel}</h2>
          <button onClick={onClose} className="text-slate-400">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {(["entrada", "saida", "ajuste"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={
                  "rounded-xl py-2.5 text-[13px] font-semibold capitalize transition " +
                  (type === t ? "bg-brand-500 text-white" : "bg-surface-muted text-slate-600")
                }
              >
                {t}
              </button>
            ))}
          </div>

          <div>
            <label className="label">Quantidade</label>
            <input
              type="number"
              min={1}
              className="input-field"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              autoFocus
            />
          </div>

          <div>
            <label className="label">Motivo (opcional)</label>
            <input className="input-field" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>

          {error && <p className="text-[13px] text-danger">{error}</p>}

          <button type="submit" className="btn-primary w-full" disabled={isPending}>
            {isPending ? "Salvando..." : "Confirmar"}
          </button>
        </form>
      </div>
    </div>
  );
}
