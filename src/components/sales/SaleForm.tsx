"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CloudOff, Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { SelectField, type SelectOption } from "@/components/ui/SelectField";
import { setCachedValue } from "@/lib/offline/db";
import { submitOfflineCapableOperation } from "@/lib/offline/sync";
import { formatCurrency } from "@/utils/format";

type Customer = { id: string; name: string };
type Product = { id: string; name: string; sale_price: number };
type Variant = {
  id: string;
  product_id: string;
  variant_name: string;
  stock_quantity: number;
  sale_price: number | null;
};

type CartItem = { variantId: string; quantity: number };

export type OfflineSaleReference = {
  customers: Customer[];
  products: Product[];
  variants: Variant[];
  cachedAt: string;
};

const PAYMENT_OPTIONS: SelectOption[] = [
  { value: "pix", label: "Pix", description: "Pagamento imediato" },
  { value: "dinheiro", label: "Dinheiro", description: "Pagamento em espécie" },
  { value: "cartao", label: "Cartão", description: "Crédito ou débito" },
  { value: "fiado", label: "Fiado", description: "Valor fica em aberto" },
  { value: "parcelado", label: "Parcelado", description: "Pagamento em parcelas" },
];

export function SaleForm({
  customers,
  products,
  variants,
}: {
  customers: Customer[];
  products: Product[];
  variants: Variant[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [customerId, setCustomerId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("parcelado");
  const [downPayment, setDownPayment] = useState("");
  const [installmentsCount, setInstallmentsCount] = useState("2");
  const [firstDueDate, setFirstDueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [selectedVariant, setSelectedVariant] = useState("");
  const [items, setItems] = useState<CartItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!customers.length && !products.length && !variants.length) return;
    void setCachedValue<OfflineSaleReference>("sale:reference", {
      customers,
      products,
      variants,
      cachedAt: new Date().toISOString(),
    }).catch(() => undefined);
  }, [customers, products, variants]);

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const variantById = useMemo(() => new Map(variants.map((v) => [v.id, v])), [variants]);

  const customerOptions = useMemo<SelectOption[]>(
    () => [
      { value: "", label: "Venda sem cliente", description: "Venda avulsa, sem vínculo com ficha" },
      ...customers.map((customer) => ({
        value: customer.id,
        label: customer.name,
        description: "Cliente cadastrado",
      })),
    ],
    [customers]
  );

  const variantOptions = useMemo<SelectOption[]>(
    () =>
      variants
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
    const price = Number(variant.sale_price ?? product?.sale_price ?? 0);
    return sum + price * item.quantity;
  }, 0);

  function addItem() {
    if (!selectedVariant) return;
    const variant = variantById.get(selectedVariant);
    if (!variant || variant.stock_quantity <= 0) return;
    setItems((current) => {
      const existing = current.find((item) => item.variantId === selectedVariant);
      if (existing) {
        return current.map((item) =>
          item.variantId === selectedVariant
            ? { ...item, quantity: Math.min(item.quantity + 1, variant.stock_quantity) }
            : item
        );
      }
      return [...current, { variantId: selectedVariant, quantity: 1 }];
    });
    setSelectedVariant("");
  }

  function changeQuantity(variantId: string, delta: number) {
    const variant = variantById.get(variantId);
    setItems((current) =>
      current
        .map((item) => {
          if (item.variantId !== variantId) return item;
          const next = Math.max(0, Math.min(item.quantity + delta, variant?.stock_quantity ?? item.quantity));
          return { ...item, quantity: next };
        })
        .filter((item) => item.quantity > 0)
    );
  }

  function resetForm() {
    setItems([]);
    setCustomerId("");
    setDownPayment("");
    setNotes("");
    setSelectedVariant("");
  }

  function submit() {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const input = {
        customerId: customerId || null,
        items: items.map((item) => ({ product_variant_id: item.variantId, quantity: item.quantity })),
        paymentMethod,
        downPayment: Number(downPayment.replace(",", ".")) || 0,
        installmentsCount: Number(installmentsCount) || 1,
        firstDueDate,
        notes,
      };

      try {
        const result = await submitOfflineCapableOperation("sale", input);

        if (result.synced && result.resultId) {
          router.push(`/vender/${result.resultId}`);
          router.refresh();
          return;
        }

        if (result.queued) {
          resetForm();
          setNotice(
            result.error
              ? `Venda salva no aparelho, mas a sincronização precisa de atenção: ${result.error}`
              : "Venda salva no aparelho. Ela será sincronizada automaticamente quando a internet voltar."
          );
          return;
        }

        setError(result.error ?? "Não foi possível concluir a venda.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não foi possível salvar a venda offline.");
      }
    });
  }

  const needsCustomer = paymentMethod === "fiado" || paymentMethod === "parcelado";

  return (
    <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
      <div className="space-y-4">
        <div className="card">
          <label className="label">Cliente {needsCustomer ? "*" : "(opcional)"}</label>
          <SelectField
            value={customerId}
            onChange={setCustomerId}
            options={customerOptions}
            searchable={customers.length > 6}
            searchPlaceholder="Buscar cliente..."
          />
        </div>

        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-bold text-slate-900">Produtos</h2>
            <span className="text-xs text-slate-500">{items.length} item(ns)</span>
          </div>

          <div className="flex items-start gap-2">
            <SelectField
              className="min-w-0 flex-1"
              value={selectedVariant}
              onChange={setSelectedVariant}
              options={variantOptions}
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
              <Plus size={19} />
            </button>
          </div>

          {items.length === 0 ? (
            <div className="rounded-xl bg-surface-muted py-8 text-center text-sm text-slate-500">
              <ShoppingCart className="mx-auto mb-2 text-slate-300" size={28} />
              Adicione os produtos da venda.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {items.map((item) => {
                const variant = variantById.get(item.variantId)!;
                const product = productById.get(variant.product_id);
                const price = Number(variant.sale_price ?? product?.sale_price ?? 0);
                return (
                  <li key={item.variantId} className="flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-800">{product?.name}</p>
                      <p className="text-xs text-slate-500">{variant.variant_name} · {formatCurrency(price)}</p>
                    </div>
                    <div className="flex items-center gap-1 rounded-xl bg-surface-muted p-1">
                      <button type="button" onClick={() => changeQuantity(item.variantId, -1)} className="p-2 text-slate-500"><Minus size={15} /></button>
                      <span className="w-6 text-center text-sm font-bold">{item.quantity}</span>
                      <button type="button" onClick={() => changeQuantity(item.variantId, 1)} className="p-2 text-slate-500"><Plus size={15} /></button>
                    </div>
                    <button type="button" onClick={() => setItems((x) => x.filter((i) => i.variantId !== item.variantId))} className="p-2 text-danger"><Trash2 size={17} /></button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="card space-y-3">
          <h2 className="text-[15px] font-bold text-slate-900">Pagamento</h2>
          <div>
            <label className="label">Forma de pagamento</label>
            <SelectField value={paymentMethod} onChange={setPaymentMethod} options={PAYMENT_OPTIONS} />
          </div>

          {(paymentMethod === "fiado" || paymentMethod === "parcelado") && (
            <>
              <div>
                <label className="label">Entrada</label>
                <input className="input-field" inputMode="decimal" value={downPayment} onChange={(e) => setDownPayment(e.target.value)} placeholder="0,00" />
              </div>
              {paymentMethod === "parcelado" && (
                <div>
                  <label className="label">Quantidade de parcelas</label>
                  <input className="input-field" type="number" min="1" max="36" value={installmentsCount} onChange={(e) => setInstallmentsCount(e.target.value)} />
                </div>
              )}
              <div>
                <label className="label">Primeiro vencimento</label>
                <input className="input-field" type="date" value={firstDueDate} onChange={(e) => setFirstDueDate(e.target.value)} />
              </div>
            </>
          )}

          <div>
            <label className="label">Observações</label>
            <textarea className="input-field min-h-24" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">Total da venda</span>
            <span className="text-2xl font-bold text-slate-900">{formatCurrency(total)}</span>
          </div>
          {notice && <p className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800"><CloudOff size={16} className="mt-0.5 flex-none" />{notice}</p>}
          {error && <p className="mt-3 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
          <button type="button" onClick={submit} disabled={isPending || items.length === 0 || (needsCustomer && !customerId)} className="btn-primary mt-4 w-full">
            {isPending ? "Salvando..." : "Concluir venda"}
          </button>
        </div>
      </div>
    </div>
  );
}
