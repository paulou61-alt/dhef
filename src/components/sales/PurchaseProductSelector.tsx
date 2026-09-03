"use client";

import { useMemo, useState } from "react";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { SelectField, type SelectOption } from "@/components/ui/SelectField";
import { formatCurrency } from "@/utils/format";

export type PurchaseProduct = {
  id: string;
  name: string;
  sale_price: number;
};

export type PurchaseVariant = {
  id: string;
  product_id: string;
  variant_name: string;
  stock_quantity: number;
  sale_price: number | null;
};

export type PurchaseItem = {
  variantId: string;
  quantity: number;
};

export function PurchaseProductSelector({
  products,
  variants,
  items,
  onChange,
  compact = false,
}: {
  products: PurchaseProduct[];
  variants: PurchaseVariant[];
  items: PurchaseItem[];
  onChange: (items: PurchaseItem[]) => void;
  compact?: boolean;
}) {
  const [selectedVariant, setSelectedVariant] = useState("");
  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const variantById = useMemo(() => new Map(variants.map((variant) => [variant.id, variant])), [variants]);

  const options = useMemo<SelectOption[]>(
    () => variants
      .filter((variant) => variant.stock_quantity > 0)
      .map((variant) => {
        const product = productById.get(variant.product_id);
        const price = Number(variant.sale_price ?? product?.sale_price ?? 0);
        return {
          value: variant.id,
          label: `${product?.name ?? "Produto"} — ${variant.variant_name}`,
          description: `${variant.stock_quantity} em estoque · ${formatCurrency(price)}`,
        };
      }),
    [variants, productById]
  );

  const total = items.reduce((sum, item) => {
    const variant = variantById.get(item.variantId);
    if (!variant) return sum;
    const product = productById.get(variant.product_id);
    return sum + Number(variant.sale_price ?? product?.sale_price ?? 0) * item.quantity;
  }, 0);

  function addItem() {
    if (!selectedVariant) return;
    const variant = variantById.get(selectedVariant);
    if (!variant || variant.stock_quantity <= 0) return;

    const existing = items.find((item) => item.variantId === selectedVariant);
    if (existing) {
      onChange(items.map((item) =>
        item.variantId === selectedVariant
          ? { ...item, quantity: Math.min(item.quantity + 1, variant.stock_quantity) }
          : item
      ));
    } else {
      onChange([...items, { variantId: selectedVariant, quantity: 1 }]);
    }
    setSelectedVariant("");
  }

  function changeQuantity(variantId: string, delta: number) {
    const variant = variantById.get(variantId);
    onChange(
      items
        .map((item) => {
          if (item.variantId !== variantId) return item;
          const next = Math.max(0, Math.min(item.quantity + delta, variant?.stock_quantity ?? item.quantity));
          return { ...item, quantity: next };
        })
        .filter((item) => item.quantity > 0)
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2">
        <SelectField
          className="min-w-0 flex-1"
          value={selectedVariant}
          onChange={setSelectedVariant}
          options={options}
          placeholder="Selecione um produto/variação"
          searchable
          searchPlaceholder="Buscar produto ou variação..."
        />
        <button
          type="button"
          onClick={addItem}
          disabled={!selectedVariant}
          className="btn-primary flex h-12 w-12 flex-none items-center justify-center px-0 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Adicionar produto"
        >
          <Plus size={18} />
        </button>
      </div>

      {items.length === 0 ? (
        <div className={`rounded-xl bg-surface-muted text-center text-sm text-slate-500 ${compact ? "py-4" : "py-6"}`}>
          <ShoppingCart className="mx-auto mb-1.5 text-slate-300" size={22} />
          Nenhum produto selecionado.
        </div>
      ) : (
        <div className="divide-y divide-slate-100 rounded-xl border border-slate-100 bg-white">
          {items.map((item) => {
            const variant = variantById.get(item.variantId);
            if (!variant) return null;
            const product = productById.get(variant.product_id);
            const price = Number(variant.sale_price ?? product?.sale_price ?? 0);
            return (
              <div key={item.variantId} className="flex items-center gap-2 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">{product?.name ?? "Produto"}</p>
                  <p className="text-xs text-slate-500">{variant.variant_name} · {formatCurrency(price)}</p>
                </div>
                <div className="flex items-center gap-1 rounded-xl bg-surface-muted p-1">
                  <button type="button" onClick={() => changeQuantity(item.variantId, -1)} className="p-1.5 text-slate-500"><Minus size={14} /></button>
                  <span className="w-5 text-center text-xs font-bold">{item.quantity}</span>
                  <button type="button" onClick={() => changeQuantity(item.variantId, 1)} className="p-1.5 text-slate-500"><Plus size={14} /></button>
                </div>
                <button type="button" onClick={() => onChange(items.filter((current) => current.variantId !== item.variantId))} className="p-2 text-danger"><Trash2 size={16} /></button>
              </div>
            );
          })}
          <div className="flex items-center justify-between px-3 py-2.5 text-sm">
            <span className="font-medium text-slate-500">Total da compra</span>
            <span className="font-bold text-slate-900">{formatCurrency(total)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
