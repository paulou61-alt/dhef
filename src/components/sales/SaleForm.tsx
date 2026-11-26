"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CloudOff, CreditCard, Minus, Package, Plus, ShoppingCart, Trash2, UserRound } from "lucide-react";
import { SelectField, type SelectOption } from "@/components/ui/SelectField";
import { setCachedValue } from "@/lib/offline/db";
import { submitOfflineCapableOperation } from "@/lib/offline/sync";
import { formatCurrency, todayInBrazil } from "@/utils/format";

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

function getDefaultVariantId(products: Product[], variants: Variant[]) {
  const productsById = new Map(products.map((product) => [product.id, product]));

  const preferredVariant = variants.find((variant) => {
    if (variant.stock_quantity <= 0) return false;

    const product = productsById.get(variant.product_id);
    if (!product) return false;

    const productName = product.name.toLocaleLowerCase("pt-BR");
    const variantName = variant.variant_name.toLocaleLowerCase("pt-BR");
    const price = Number(variant.sale_price ?? product.sale_price ?? 0);

    return productName.includes("rancho") && variantName.includes("padr") && Math.abs(price - 480) < 0.005;
  });

  return preferredVariant?.id ?? "";
}

export function SaleForm({
  customers,
  products,
  variants,
  sellers = [],
}: {
  customers: Customer[];
  products: Product[];
  variants: Variant[];
  /** Colaboradores com cargo de vendedor. Só o proprietário recebe a lista. */
  sellers?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [customerId, setCustomerId] = useState("");
  const [sellerId, setSellerId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("parcelado");
  const [downPayment, setDownPayment] = useState("");
  const [installmentsCount, setInstallmentsCount] = useState("2");
  const [firstDueDate, setFirstDueDate] = useState(() => todayInBrazil());
  const [notes, setNotes] = useState("");
  const [selectedVariant, setSelectedVariant] = useState(() => getDefaultVariantId(products, variants));
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
    setSellerId("");
    setDownPayment("");
    setNotes("");
    setSelectedVariant(getDefaultVariantId(products, variants));
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
        ...(sellerId ? { sellerId } : {}),
      };

      try {
        const result = await submitOfflineCapableOperation("sale", input);

        if (result.synced && result.resultId) {
          if (result.warning) window.alert(result.warning);
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
        <div className="glass animate-rise p-5" style={{ animationDelay: "100ms" }}>
          <SectionTitle icon={UserRound} title="Cliente e vendedor" />
          <label className="label">Cliente {needsCustomer ? "*" : "(opcional)"}</label>
          <SelectField
            value={customerId}
            onChange={setCustomerId}
            options={customerOptions}
            searchable={customers.length > 6}
            searchPlaceholder="Buscar cliente..."
          />
          {sellers.length > 0 && (
            <div className="mt-4">
              <label className="label">Vendedor responsável</label>
              <SelectField
                value={sellerId}
                onChange={setSellerId}
                options={[
                  { value: "", label: "Nenhum", description: "Venda feita por você" },
                  ...sellers.map((seller) => ({ value: seller.id, label: seller.name, description: "Vendedor" })),
                ]}
                searchable={sellers.length > 6}
                searchPlaceholder="Buscar vendedor..."
              />
            </div>
          )}
        </div>

        <div className="glass animate-rise space-y-3 p-5" style={{ animationDelay: "160ms" }}>
          <div className="flex items-center justify-between">
            <SectionTitle icon={Package} title="Produtos" className="!mb-0" />
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11.5px] font-medium tabular-nums text-slate-600">{items.length} item(ns)</span>
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
            <div className="rounded-2xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-500 dark:border-white/10">
              <ShoppingCart className="mx-auto mb-2 text-slate-300" size={28} />
              Adicione os produtos da venda.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200/70 bg-white/60 px-3 dark:border-white/[.07] dark:!bg-white/[.03]">
              {items.map((item) => {
                const variant = variantById.get(item.variantId)!;
                const product = productById.get(variant.product_id);
                const price = Number(variant.sale_price ?? product?.sale_price ?? 0);
                return (
                  <li key={item.variantId} className="flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-medium text-slate-900">{product?.name}</p>
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
        <div className="glass animate-rise space-y-3 p-5" style={{ animationDelay: "120ms" }}>
          <SectionTitle icon={CreditCard} title="Pagamento" />
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

        <div className="glass animate-rise p-5 lg:sticky lg:top-6" style={{ animationDelay: "180ms" }}>
          <div className="flex items-end justify-between gap-3">
            <div>
              <span className="text-[13px] font-medium text-slate-500">Total da venda</span>
              <p className="text-[12px] text-slate-400">{items.reduce((sum, item) => sum + item.quantity, 0)} unidade(s)</p>
            </div>
            <span className="whitespace-nowrap text-[30px] font-semibold leading-none tracking-[-0.04em] text-slate-900">{formatCurrency(total)}</span>
          </div>
          {notice && <p className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800"><CloudOff size={16} className="mt-0.5 flex-none" />{notice}</p>}
          {error && <p className="mt-3 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
          <button type="button" onClick={submit} disabled={isPending || items.length === 0 || (needsCustomer && !customerId)} className="btn-primary mt-4 w-full !py-3.5 text-[15px]">
            {isPending ? "Salvando..." : "Concluir venda"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ icon: Icon, title, className = "" }: { icon: typeof Package; title: string; className?: string }) {
  return (
    <h2 className={`mb-4 flex items-center gap-2.5 text-[15px] font-semibold text-slate-900 ${className}`}>
      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-100 dark:text-brand-300"><Icon size={16} /></span>
      {title}
    </h2>
  );
}
