"use client";

import { useState, useTransition } from "react";
import { CloudOff, ShoppingBag } from "lucide-react";
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
  products = [],
  variants = [],
  successHref,
}: {
  installmentId: string;
  openAmount: number;
  buttonLabel?: string;
  products?: PurchaseProduct[];
  variants?: PurchaseVariant[];
  /** Endereço aberto depois de salvar. Sem ele, a página atual é recarregada. */
  successHref?: string;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(openAmount.toFixed(2)).replace(".", ","));
  const [method, setMethod] = useState<"pix" | "dinheiro" | "cartao">("pix");
  const [date, setDate] = useState(() => todayInBrazil());
  const [notes, setNotes] = useState("");
  const [nextDueDate, setNextDueDate] = useState("");
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([]);
  const [purchasePaymentMethod, setPurchasePaymentMethod] = useState("parcelado");
  const [purchaseDownPayment, setPurchaseDownPayment] = useState("");
  const [purchaseInstallments, setPurchaseInstallments] = useState("2");
  const [purchaseFirstDueDate, setPurchaseFirstDueDate] = useState(() => todayInBrazil());
  const [purchaseNotes, setPurchaseNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const parsedAmount = Number(amount.replace(",", "."));
  const excessAmount = Number.isFinite(parsedAmount) ? Math.round((parsedAmount - openAmount) * 100) / 100 : 0;
  // Pagou diferente do saldo da parcela: dá para escolher o vencimento do que ficou em aberto.
  const canReschedule = Number.isFinite(parsedAmount) && parsedAmount > 0 && excessAmount !== 0 && !(excessAmount > 0 && purchaseItems.length > 0);

  const purchaseNeedsTerms = purchasePaymentMethod === "fiado" || purchasePaymentMethod === "parcelado";

  function resetPurchase() {
    setPurchaseItems([]);
    setPurchasePaymentMethod("parcelado");
    setPurchaseDownPayment("");
    setPurchaseInstallments("2");
    setPurchaseFirstDueDate(todayInBrazil());
    setPurchaseNotes("");
  }

  function submit() {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      try {
        const hasPurchase = purchaseItems.length > 0;
        const payload: Record<string, unknown> = {
          installmentId,
          amount: Number(amount.replace(",", ".")),
          paymentMethod: method,
          paymentDate: date,
          notes,
        };
        if (canReschedule && nextDueDate) payload.nextDueDate = nextDueDate;

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
      }
    });
  }

  return (
    <>
      <div className="flex flex-col items-end gap-1.5">
        <button type="button" onClick={() => setOpen(true)} className="rounded-xl bg-brand-500 px-3 py-2 text-xs font-semibold text-white">{buttonLabel}</button>
        {notice && <span className="max-w-[240px] rounded-lg bg-amber-50 px-2 py-1 text-right text-[10px] font-medium text-amber-800"><CloudOff size={11} className="mr-1 inline" />{notice}</span>}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4">
          <div className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-floating sm:rounded-2xl">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-slate-900">Registrar recebimento</h2>
              <p className="text-sm text-slate-500">Saldo atual: {formatCurrency(openAmount)}</p>
            </div>

            <div className="space-y-4">
              <section className="space-y-3">
                <div>
                  <label className="label">Valor recebido</label>
                  <input className="input-field" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
                  {excessAmount > 0 && (
                    purchaseItems.length > 0 ? (
                      <p className="mt-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
                        Junto com uma nova compra, o valor recebido não pode passar do saldo desta parcela ({formatCurrency(openAmount)}).
                      </p>
                    ) : (
                      <p className="mt-1.5 rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs text-brand-700">
                        {formatCurrency(excessAmount)} a mais que esta parcela. A diferença será abatida automaticamente nas próximas parcelas do cliente.
                      </p>
                    )
                  )}
                </div>
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

              {error && <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button type="button" onClick={() => setOpen(false)} className="btn-secondary">Cancelar</button>
                <button type="button" disabled={pending} onClick={submit} className="btn-primary">{pending ? "Salvando..." : purchaseItems.length > 0 ? "Receber + vender" : "Confirmar"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
