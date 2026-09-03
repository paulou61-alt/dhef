"use client";

import { useState, useTransition } from "react";
import { maskPhone, maskCEP, maskCPF, maskCurrencyInput } from "@/utils/masks";
import type { Customer } from "@/types/database.types";
import type { CustomerFormState } from "@/app/(app)/clientes/actions";
import {
  PurchaseProductSelector,
  type PurchaseItem,
  type PurchaseProduct,
  type PurchaseVariant,
} from "@/components/sales/PurchaseProductSelector";

const BR_STATES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

export interface CustomerCollaboratorOption {
  id: string;
  name: string;
  role: "vendedor" | "cobrador";
}

function getDefaultInitialPurchase(products: PurchaseProduct[], variants: PurchaseVariant[]): PurchaseItem[] {
  const productById = new Map(products.map((product) => [product.id, product]));
  const effectivePrice = (variant: PurchaseVariant) => {
    const product = productById.get(variant.product_id);
    return Number(variant.sale_price ?? product?.sale_price ?? 0);
  };

  const preferred = variants.find((variant) => {
    const product = productById.get(variant.product_id);
    return variant.stock_quantity > 0
      && Math.abs(effectivePrice(variant) - 480) < 0.01
      && (product?.name ?? "").toLocaleLowerCase("pt-BR").includes("rancho");
  }) ?? variants.find((variant) => variant.stock_quantity > 0 && Math.abs(effectivePrice(variant) - 480) < 0.01);

  return preferred ? [{ variantId: preferred.id, quantity: 1 }] : [];
}

export function CustomerForm({
  customer,
  action,
  collaborators = [],
  products = [],
  variants = [],
  accessRole = "owner",
}: {
  customer?: Customer;
  action: (formData: FormData) => Promise<CustomerFormState>;
  collaborators?: CustomerCollaboratorOption[];
  products?: PurchaseProduct[];
  variants?: PurchaseVariant[];
  accessRole?: "owner" | "vendedor" | "cobrador";
}) {
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const [whatsapp, setWhatsapp] = useState(customer?.whatsapp ?? "");
  const [cpf, setCpf] = useState(customer?.cpf ?? "");
  const [zip, setZip] = useState(customer?.zip_code ?? "");
  const [creditLimit, setCreditLimit] = useState(customer?.credit_limit ? customer.credit_limit.toFixed(2).replace(".", ",") : "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [sameAsPhone, setSameAsPhone] = useState(!customer?.whatsapp || customer.whatsapp === customer.phone);
  const [initialItems, setInitialItems] = useState<PurchaseItem[]>(() => customer ? [] : getDefaultInitialPurchase(products, variants));
  const [initialPaymentMethod, setInitialPaymentMethod] = useState("parcelado");
  const [initialInstallments, setInitialInstallments] = useState("2");
  const [initialFirstDueDate, setInitialFirstDueDate] = useState(() => new Date().toISOString().slice(0, 10));

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    if (sameAsPhone) formData.set("whatsapp", phone);
    formData.set(
      "initial_purchase_items",
      JSON.stringify(initialItems.map((item) => ({ product_variant_id: item.variantId, quantity: item.quantity })))
    );

    startTransition(async () => {
      const result = await action(formData);
      if (result?.error) setError(result.error);
    });
  }

  const initialNeedsTerms = initialPaymentMethod === "fiado" || initialPaymentMethod === "parcelado";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <section className="card space-y-4">
        <h2 className="text-[14px] font-bold text-slate-900">Dados básicos</h2>

        <div className="grid gap-3 sm:grid-cols-[150px_minmax(0,1fr)]">
          <div>
            <label className="label" htmlFor="ficha_number">Número da ficha *</label>
            <input
              id="ficha_number"
              name="ficha_number"
              type="number"
              min="1"
              max="1000"
              step="1"
              inputMode="numeric"
              required
              readOnly={Boolean(customer)}
              className={`input-field font-semibold ${customer ? "cursor-not-allowed bg-slate-50 text-slate-500" : ""}`}
              placeholder="Ex.: 25"
              defaultValue={customer?.ficha_number ?? ""}
            />
            <p className="mt-1 text-[11px] text-slate-400">
              {customer ? "O número fica travado após o cadastro." : "Use uma ficha de #1 a #1000. A numeração pode se repetir em colaboradores diferentes."}
            </p>
          </div>

          <div>
            <label className="label" htmlFor="name">Nome *</label>
            <input id="name" name="name" required className="input-field" placeholder="Nome completo" defaultValue={customer?.name} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="phone">Telefone</label>
            <input id="phone" name="phone" className="input-field" placeholder="(00) 00000-0000" value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} inputMode="numeric" />
          </div>
          <div>
            <label className="label" htmlFor="cpf">CPF</label>
            <input id="cpf" name="cpf" className="input-field" placeholder="000.000.000-00" value={cpf} onChange={(e) => setCpf(maskCPF(e.target.value))} inputMode="numeric" />
          </div>
        </div>

        <div>
          <label className="flex items-center gap-2 text-[13px] font-medium text-slate-600">
            <input type="checkbox" checked={sameAsPhone} onChange={(e) => setSameAsPhone(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-200" />
            WhatsApp é o mesmo número do telefone
          </label>
          {!sameAsPhone && (
            <input name="whatsapp" className="input-field mt-2" placeholder="(00) 00000-0000" value={whatsapp} onChange={(e) => setWhatsapp(maskPhone(e.target.value))} inputMode="numeric" />
          )}
        </div>

        {accessRole === "owner" && (
          <div>
            <label className="label" htmlFor="assigned_collaborator_id">Colaborador responsável</label>
            <select id="assigned_collaborator_id" name="assigned_collaborator_id" className="input-field" defaultValue={customer?.assigned_collaborator_id ?? ""}>
              <option value="">Sem colaborador</option>
              {collaborators.map((collaborator) => (
                <option key={collaborator.id} value={collaborator.id}>
                  {collaborator.name} — {collaborator.role === "vendedor" ? "Vendedor" : "Cobrador"}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-slate-400">Cada colaborador possui sua própria sequência de fichas #1 a #1000.</p>
          </div>
        )}

        {accessRole === "vendedor" && collaborators[0] && (
          <div className="rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-700">
            Este cliente será vinculado a <strong>{collaborators[0].name}</strong>. As fichas deste colaborador vão de #1 a #1000.
          </div>
        )}
      </section>

      <section className="card space-y-4">
        <h2 className="text-[14px] font-bold text-slate-900">Endereço</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="zip_code">CEP</label>
            <input id="zip_code" name="zip_code" className="input-field" placeholder="00000-000" value={zip} onChange={(e) => setZip(maskCEP(e.target.value))} inputMode="numeric" />
          </div>
          <div>
            <label className="label" htmlFor="state">Estado</label>
            <select id="state" name="state" className="input-field" defaultValue={customer?.state ?? ""}>
              <option value="">Selecione</option>
              {BR_STATES.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="label" htmlFor="address">Endereço</label>
          <input id="address" name="address" className="input-field" placeholder="Rua, número" defaultValue={customer?.address ?? ""} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="neighborhood">Bairro</label>
            <input id="neighborhood" name="neighborhood" className="input-field" defaultValue={customer?.neighborhood ?? ""} />
          </div>
          <div>
            <label className="label" htmlFor="city">Cidade</label>
            <input id="city" name="city" className="input-field" defaultValue={customer?.city ?? ""} />
          </div>
        </div>
      </section>

      {!customer && (
        <section className="card space-y-4">
          <div>
            <h2 className="text-[14px] font-bold text-slate-900">Primeira compra (opcional)</h2>
            <p className="mt-1 text-xs text-slate-500">Selecione os produtos agora para cadastrar o cliente e a primeira venda de uma vez.</p>
          </div>

          <PurchaseProductSelector
            products={products}
            variants={variants}
            items={initialItems}
            onChange={setInitialItems}
          />

          {initialItems.length > 0 && (
            <div className="space-y-3 rounded-2xl bg-surface-muted p-4">
              <div>
                <label className="label" htmlFor="initial_payment_method">Forma de pagamento</label>
                <select
                  id="initial_payment_method"
                  name="initial_payment_method"
                  className="input-field bg-white"
                  value={initialPaymentMethod}
                  onChange={(e) => setInitialPaymentMethod(e.target.value)}
                >
                  <option value="parcelado">Parcelado</option>
                  <option value="fiado">Fiado</option>
                  <option value="pix">Pix</option>
                  <option value="dinheiro">Dinheiro</option>
                  <option value="cartao">Cartão</option>
                </select>
              </div>

              {initialNeedsTerms && (
                <>
                  <div>
                    <label className="label" htmlFor="initial_down_payment">Entrada</label>
                    <input
                      id="initial_down_payment"
                      name="initial_down_payment"
                      className="input-field bg-white"
                      placeholder="0,00"
                      inputMode="numeric"
                      onInput={(e) => { e.currentTarget.value = maskCurrencyInput(e.currentTarget.value); }}
                    />
                  </div>
                  {initialPaymentMethod === "parcelado" && (
                    <div>
                      <label className="label" htmlFor="initial_installments_count">Quantidade de parcelas</label>
                      <input
                        id="initial_installments_count"
                        name="initial_installments_count"
                        className="input-field bg-white"
                        type="number"
                        min="1"
                        max="36"
                        value={initialInstallments}
                        onChange={(e) => setInitialInstallments(e.target.value)}
                      />
                    </div>
                  )}
                  <div>
                    <label className="label" htmlFor="initial_first_due_date">Primeiro vencimento</label>
                    <input
                      id="initial_first_due_date"
                      name="initial_first_due_date"
                      className="input-field bg-white"
                      type="date"
                      value={initialFirstDueDate}
                      onChange={(e) => setInitialFirstDueDate(e.target.value)}
                    />
                  </div>
                </>
              )}

              <div>
                <label className="label" htmlFor="initial_purchase_notes">Observação da compra</label>
                <input id="initial_purchase_notes" name="initial_purchase_notes" className="input-field bg-white" placeholder="Opcional" />
              </div>
            </div>
          )}
        </section>
      )}

      <section className="card space-y-4">
        <h2 className="text-[14px] font-bold text-slate-900">Outros</h2>

        {!customer && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
            <label className="label !text-amber-900" htmlFor="opening_balance">Saldo devedor inicial (opcional)</label>
            <input
              id="opening_balance"
              name="opening_balance"
              className="input-field bg-white"
              placeholder="0,00"
              inputMode="numeric"
              onInput={(e) => { e.currentTarget.value = maskCurrencyInput(e.currentTarget.value); }}
            />
            <p className="mt-1.5 text-[11px] leading-relaxed text-amber-800/80">
              Use se o cliente já possui um valor em aberto antes deste cadastro. O saldo entrará em Receber, Cobranças e no histórico da ficha.
            </p>
          </div>
        )}

        <div>
          <label className="label" htmlFor="credit_limit">Limite de crédito (opcional)</label>
          <input id="credit_limit" name="credit_limit" className="input-field" placeholder="0,00" value={creditLimit} onChange={(e) => setCreditLimit(maskCurrencyInput(e.target.value))} inputMode="numeric" />
        </div>
        <div>
          <label className="label" htmlFor="notes">Observações</label>
          <textarea id="notes" name="notes" rows={3} className="input-field resize-none" defaultValue={customer?.notes ?? ""} />
        </div>
      </section>

      {error && <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}
      <button type="submit" className="btn-primary w-full" disabled={isPending}>{isPending ? "Salvando..." : "Salvar cliente"}</button>
    </form>
  );
}
