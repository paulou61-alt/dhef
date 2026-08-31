"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, SlidersHorizontal } from "lucide-react";
import { StockAdjustSheet } from "@/components/products/StockAdjustSheet";
import { formatCurrency } from "@/utils/format";

export interface StockRow {
  id: string;
  productName: string;
  variantName: string;
  stockQuantity: number;
  minStock: number;
  costPrice: number;
}

export function StockList({ rows }: { rows: StockRow[] }) {
  const [selected, setSelected] = useState<StockRow | null>(null);

  return (
    <>
      <ul className="card divide-y divide-slate-100 !p-0">
        {rows.map((row) => {
          const isLow = row.stockQuantity <= row.minStock;
          const label = row.variantName === "Padrão" ? row.productName : `${row.productName} · ${row.variantName}`;

          return (
            <li key={row.id} className="flex items-center gap-3 px-4 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold text-slate-800">{label}</p>
                <p className="text-[12px] text-slate-500">
                  Valor em estoque: {formatCurrency(row.stockQuantity * row.costPrice)}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {isLow && <AlertTriangle size={14} className="text-warning" />}
                <span className={`text-[14px] font-bold ${isLow ? "text-warning" : "text-slate-900"}`}>
                  {row.stockQuantity}
                </span>
              </div>
              <button
                onClick={() => setSelected(row)}
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-surface-muted text-slate-500"
                aria-label="Ajustar estoque"
              >
                <SlidersHorizontal size={16} />
              </button>
            </li>
          );
        })}
      </ul>

      {selected && (
        <StockAdjustSheet
          variantId={selected.id}
          variantLabel={
            selected.variantName === "Padrão" ? selected.productName : `${selected.productName} · ${selected.variantName}`
          }
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
