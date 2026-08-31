"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import type { VariantInput } from "@/app/(app)/estoque/produtos/actions";

export function AddVariantForm({
  productId,
  action,
}: {
  productId: string;
  action: (productId: string, variant: VariantInput) => Promise<{ error?: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [stock, setStock] = useState("0");
  const [minStock, setMinStock] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Informe um nome para a variação.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await action(productId, {
        variant_name: name.trim(),
        attributes: {},
        stock_quantity: parseInt(stock, 10) || 0,
        min_stock: parseInt(minStock, 10) || 0,
      });
      if (result?.error) {
        setError(result.error);
      } else {
        setName("");
        setStock("0");
        setMinStock("0");
        setOpen(false);
      }
    });
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-secondary w-full">
        <Plus size={16} />
        Adicionar variação
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 rounded-xl border border-slate-200 p-3">
      <input
        className="input-field"
        placeholder="Nome da variação (ex: Verde / 40)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          type="number"
          min={0}
          className="input-field"
          placeholder="Estoque"
          value={stock}
          onChange={(e) => setStock(e.target.value)}
        />
        <input
          type="number"
          min={0}
          className="input-field"
          placeholder="Mínimo"
          value={minStock}
          onChange={(e) => setMinStock(e.target.value)}
        />
      </div>
      {error && <p className="text-[12px] text-danger">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(false)} className="btn-secondary flex-1">
          Cancelar
        </button>
        <button type="submit" className="btn-primary flex-1" disabled={isPending}>
          {isPending ? "Salvando..." : "Adicionar"}
        </button>
      </div>
    </form>
  );
}
