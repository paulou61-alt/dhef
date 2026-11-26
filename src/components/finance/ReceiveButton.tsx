"use client";

import { useId, useState } from "react";
import { usePurchaseCatalog } from "@/components/sales/PurchaseCatalog";
import { BadgeMinus, CloudOff, ShoppingBag } from "lucide-react";
import { parseDiscountAmount } from "@/lib/customer-discounts";
import { receiptBalance, suggestedReceiptAmount, validateReceiptAmounts } from "@/lib/receipt-discounts";
import { submitOfflineCapableOperation } from "@/lib/offline/sync";
import { formatCurrency, todayInBrazil } from "@/utils/format";
import { SelectField } from "@/components/ui/SelectField";
import {
  PurchaseProductSelector,
  type PurchaseItem,
  type PurchaseProduct,
  type PurchaseVariant,
} from "@/components/sales/PurchaseProductSelector";

const RECEIVE_METHODS = [
  { value: "pix", label: "Pix" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "cartao", label: "Cartão" },
];

const PURCHASE_METHODS = [
  { value: "parcelado", label: "Parcelado" },
  { value: "fiado", label: "Fiado" },
  { value: "pix", label: "Pix" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "cartao", label: "Cartão" },
];

export function ReceiveButton({
  installmentId,
  openAmount,
  buttonLabel = "Receber",
  products: productsProp,
  variants: variantsProp,
  successHref,
  collectors = [],
  defaultCollectorId = "",
  allowDiscount = false,
}: {
  installmentId: string;
  openAmount: number;
  buttonLabel?: string;
  /** Sem estas listas, usa as do PurchaseCatalogProvider da página. */
  products?: PurchaseProduct[];
  variants?: PurchaseVariant[];
  /** Endereço aberto depois de salvar. Sem ele, a página atual é recarregada. */
  successHref?: string;
  /** Colaboradores com cargo de cobrador. Só o proprietário recebe a lista. */
  collectors?: { id: string; name: string }[];
  /** Cobrador já marcado ao abrir (ex.: o responsável pela ficha do cliente). */
  defaultCollectorId?: string;
  /** Apenas o proprietário pode conceder descontos. */
  allowDiscount?: boolean;
}) {
  const catalog = usePurchaseCatalog();
  const products = productsProp ?? catalog.products;
  const variants = variantsProp ?? catalog.variants;
  const fieldId = useId();
  const [discount, setDiscount] = useState("");
  const [discountNote, setDiscountNote] = useState("");
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(openAmount.toFixed(2)).replace(".", ","));
  const [method, setMethod] = useState<"pix" | "dinheiro" | "cartao">("pix");
  const [date, setDate] = useState(() => todayInBrazil());
  const [notes, setNotes] = useState("");
  const initialCollector = collectors.some((collector) => collector.id === defaultCollectorId) ? defaultCollectorId : "";
  const [collectorId, setCollectorId] = useState(initialCollector);
  const [nextDueDate, setNextDueDate] = useState("");
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([]);
  const [purchasePaymentMethod, setPurchasePaymentMethod] = useState("parcelado");
  const [purchaseDownPayment, setPurchaseDownPayment] = useState("");
  const [purchaseInstallments, setPurchaseInstallments] = useState("2");
  const [purchaseFirstDueDate, setPurchaseFirstDueDate] = useState(() => todayInBrazil());
  const [purchaseNotes, setPurchaseNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const parsedAmount = parseDiscountAmount(amount);
  const parsedDiscount = allowDiscount && discount.trim() ? parseDiscountAmount(discount) : 0;
  const validAmounts = Number.isFinite(parsedAmount) && Number.isFinite(parsedDiscount);
  const balance = receiptBalance(openAmount, parsedAmount || 0, parsedDiscount || 0);
  const excessAmount = validAmounts ? Math.round((parsedAmount + parsedDiscount - openAmount) * 100) / 100 : 0;
  // Pagou diferente do saldo da parcela: dá para escolher o vencimento do que ficou em aberto.
  const canReschedule = Number.isFinite(parsedAmount) && parsedAmount > 0 && excessAmount !== 0;

  const purchaseNeedsTerms = purchasePaymentMethod === "fiado" || purchasePaymentMethod === "parcelado";

  function resetPurchase() {
    setPurchaseItems([]);
    setPurchasePaymentMethod("parcelado");
    setPurchaseDownPayment("");
    setPurchaseInstallments("2");
    setPurchaseFirstDueDate(todayInBrazil());
    setPurchaseNotes("");
  }

  async function submit() {
    if (pending) return;
    setError(null);
    setNotice(null);
    const validation = validateReceiptAmounts(openAmount, parsedAmount, parsedDiscount);
    if (validation) return setError(validation);
    setPending(true);
    try {
      const hasPurchase = purchaseItems.length > 0;
      const payload: Record<string, unknown> = {
        installmentId,
        amount: parsedAmount,
        paymentMethod: method,
        paymentDate: date,
        notes,
      };
      if (parsedDiscount > 0) {
        payload.discountAmount = parsedDiscount;
        payload.discountNote = discountNote.trim();
      }
      if (canReschedule && nextDueDate) payload.nextDueDate = nextDueDate;
      if (collectorId) payload.collectorId = collectorId;

      if (hasPurchase) {
        payload.items = purchaseItems.map((item) => ({
          product_variant_id: item.variantId,
          quantity: item.quantity,
        }));
        payload.purchasePaymentMethod = purchasePaymentMethod;
        payload.purchaseDownPayment = Number(purchaseDownPayment.replace(",", ".")) || 0;
        payload.purchaseInstallmentsCount = Number(purchaseInstallments) || 1;
        payload.purchaseFirstDueDate = purchaseFirstDueDate;
        payload.purchaseNotes = purchaseNotes;
      }

      const result = await submitOfflineCapableOperation(hasPurchase ? "payment_purchase" : "payment", payload);

      if (result.synced) {
        setOpen(false);
        resetPurchase();
        if (result.warning) window.alert(result.warning);
        if (successHref) window.location.href = successHref;
        else window.location.reload();
        return;
      }

      if (result.queued) {
        setOpen(false);
        resetPurchase();
        setNotice(result.error
          ? `Operação salva no aparelho, mas precisa de atenção: ${result.error}`
          : hasPurchase
            ? "Recebimento e nova compra salvos offline. Serão sincronizados juntos quando a internet voltar."
            : "Recebimento salvo offline. Será sincronizado automaticamente quando a internet voltar.");
        return;
      }

      setError(result.error ?? "Não foi possível registrar o recebimento.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar o recebimento offline.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <div className="flex flex-col items-end gap-1.5">
        <button type="button" onClick={() => { setAmount(openAmount.toFixed(2).replace(".", ",")); setDiscount(""); setDiscountNote(""); setError(null); setOpen(true); }} className="whitespace-nowrap rounded-xl bg-gradient-to-b from-brand-400 to-brand-500 px-3.5 py-2 text-xs font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,.18),0_6px_16px_-6px_rgba(47,91,246,.7)] transition hover:-translate-y-0.5">{buttonLabel}</button>
        {notice && <span className="max-w-[240px] rounded-lg bg-amber-50 px-2 py-1 text-right text-[10px] font-medium text-amber-800"><CloudOff size={11} className="mr-1 inline" />{notice}</span>}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4">
          <div role="dialog" aria-modal="true" aria-labelledby={`${fieldId}-title`} className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-floating sm:rounded-2xl">
            <div className="mb-4">
              <h2 id={`${fieldId}-title`} className="text-lg font-bold text-slate-900">Registrar recebimento</h2>
              <p className="text-sm text-slate-500">Saldo atual: {formatCurrency(openAmount)}</p>
            </div>

            <fieldset disabled={pending} className="min-w-0 space-y-4">
              <section className="space-y-3">
                <div>
                  <label htmlFor={`${fieldId}-amount`} className="label">Valor recebido</label>
                  <input id={`${fieldId}-amount`} className="input-field" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
                  {excessAmount > 0 && (
                    <p className="mt-1.5 rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs text-brand-700">
                      {formatCurrency(excessAmount)} a mais que esta parcela. A diferença será abatida automaticamente nas próximas parcelas do cliente.
                    </p>
                  )}
                </div>
                {allowDiscount && (
                  <div className="space-y-3 rounded-xl border border-brand-100 bg-brand-50/40 p-3">
                    <div>
                      <label htmlFor={`${fieldId}-discount`} className="label flex items-center gap-1.5"><BadgeMinus size={15} /> Desconto (R$) — opcional</label>
                      <input id={`${fieldId}-discount`} className="input-field bg-white" inputMode="decimal" placeholder="0,00" value={discount} onChange={(event) => {
                        const next = event.target.value;
                        const nextValue = next.trim() ? parseDiscountAmount(next) : 0;
                        if (Number.isFinite(nextValue) && nextValue >= 0 && nextValue <= openAmount && Number.isFinite(parsedAmount)) {
                          const suggested = suggestedReceiptAmount(openAmount, parsedAmount, Number.isFinite(parsedDiscount) ? parsedDiscount : 0, nextValue);
                          if (suggested !== parsedAmount) setAmount(suggested.toFixed(2).replace(".", ","));
                        }
                        setDiscount(next); setError(null);
                      }} />
                      <p className="mt-1 text-[11px] text-slate-500">Abate a dívida desta parcela e fica no histórico da ficha. Não entra no caixa.</p>
                    </div>
                    {parsedDiscount > 0 && <>
                      <div>
                        <label htmlFor={`${fieldId}-discount-note`} className="label">Motivo do desconto (opcional)</label>
                        <input id={`${fieldId}-discount-note`} className="input-field bg-white" maxLength={240} value={discountNote} onChange={(event) => setDiscountNote(event.target.value)} placeholder="Ex.: acordo para quitação" />
                      </div>
                      {validAmounts && <dl aria-live="polite" className="space-y-1 text-sm">
                        <div className="flex justify-between gap-2"><dt>Dinheiro recebido</dt><dd className="font-semibold">{formatCurrency(parsedAmount)}</dd></div>
                        <div className="flex justify-between gap-2"><dt>Desconto concedido</dt><dd className="font-semibold">{formatCurrency(parsedDiscount)}</dd></div>
                        <div className="flex justify-between gap-2 border-t border-brand-100 pt-1"><dt>Saldo restante desta parcela</dt><dd className="font-bold text-brand-700">{formatCurrency(balance.remaining)}</dd></div>
                      </dl>}
                    </>}
                  </div>
                )}
                {canReschedule && (
                  <div>
                    <label className="label">{excessAmount < 0 ? "Vencimento do restante" : "Vencimento da próxima parcela"}</label>
                    <input className="input-field" type="date" value={nextDueDate} onChange={(e) => setNextDueDate(e.target.value)} />
                    <p className="mt-1 text-[11px] text-slate-400">
                      {excessAmount < 0
                        ? `Faltam ${formatCurrency(-excessAmount)} desta parcela. Escolha quando o cliente vai pagar o restante (opcional).`
                        : "Opcional. Muda o vencimento da próxima parcela que ainda ficar em aberto depois do abatimento."}
                    </p>
                  </div>
                )}
                <div>
                  <label className="label">Forma do recebimento</label>
                  <SelectField
                    value={method}
                    onChange={(value) => setMethod(value as "pix" | "dinheiro" | "cartao")}
                    options={RECEIVE_METHODS}
                  />
                </div>
                {collectors.length > 0 && (
                  <div>
                    <label className="label">Quem cobrou</label>
                    <SelectField
                      value={collectorId}
                      onChange={setCollectorId}
                      options={[
                        { value: "", label: "Eu mesmo", description: "Recebido pelo proprietário" },
                        ...collectors.map((collector) => ({ value: collector.id, label: collector.name, description: "Cobrador" })),
                      ]}
                      searchable={collectors.length > 6}
                      searchPlaceholder="Buscar cobrador..."
                    />
                  </div>
                )}
                <div>
                  <label className="label">Data</label>
                  <input className="input-field" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
                <div>
                  <label className="label">Observação do recebimento</label>
                  <input className="input-field" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" />
                </div>
              </section>

              <section className="space-y-3 rounded-2xl border border-brand-100 bg-brand-50/40 p-4">
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-xl bg-white text-brand-600"><ShoppingBag size={16} /></span>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Nova compra do cliente (opcional)</h3>
                    <p className="text-xs text-slate-500">Se ele estiver pagando e já comprando novamente, selecione os produtos abaixo.</p>
                  </div>
                </div>

                <PurchaseProductSelector
                  products={products}
                  variants={variants}
                  items={purchaseItems}
                  onChange={setPurchaseItems}
                  compact
                />

                {purchaseItems.length > 0 && (
                  <div className="space-y-3 border-t border-brand-100 pt-3">
                    <div>
                      <label className="label">Forma da nova compra</label>
                      <SelectField value={purchasePaymentMethod} onChange={setPurchasePaymentMethod} options={PURCHASE_METHODS} />
                    </div>

                    {purchaseNeedsTerms && (
                      <>
                        <div>
                          <label className="label">Entrada da nova compra</label>
                          <input className="input-field bg-white" inputMode="decimal" value={purchaseDownPayment} onChange={(e) => setPurchaseDownPayment(e.target.value)} placeholder="0,00" />
                        </div>
                        {purchasePaymentMethod === "parcelado" && (
                          <div>
                            <label className="label">Quantidade de parcelas</label>
                            <input className="input-field bg-white" type="number" min="1" max="36" value={purchaseInstallments} onChange={(e) => setPurchaseInstallments(e.target.value)} />
                          </div>
                        )}
                        <div>
                          <label className="label">Primeiro vencimento</label>
                          <input className="input-field bg-white" type="date" value={purchaseFirstDueDate} onChange={(e) => setPurchaseFirstDueDate(e.target.value)} />
                        </div>
                      </>
                    )}

                    <div>
                      <label className="label">Observação da nova compra</label>
                      <input className="input-field bg-white" value={purchaseNotes} onChange={(e) => setPurchaseNotes(e.target.value)} placeholder="Opcional" />
                    </div>
                  </div>
                )}
              </section>

              {error && <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button type="button" onClick={() => setOpen(false)} className="btn-secondary">Cancelar</button>
                <button type="button" disabled={pending} onClick={submit} className="btn-primary">{pending ? "Salvando..." : purchaseItems.length > 0 ? "Receber + vender" : "Confirmar"}</button>
              </div>
            </fieldset>
          </div>
        </div>
      )}
    </>
  );
}
