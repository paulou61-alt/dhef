"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeMinus, RotateCcw } from "lucide-react";
import { applyCustomerDiscount, reverseCustomerDiscount } from "@/app/(app)/clientes/actions";
import { parseDiscountAmount, validateDiscountAmount, type CustomerDiscount } from "@/lib/customer-discounts";
import { formatCurrency } from "@/utils/format";

function discountDate(value: string): string {
  return new Date(value).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export function CustomerDiscounts({ customerId, openAmount, discounts, canManage, loadError = false }: {
  customerId: string;
  openAmount: number;
  discounts: CustomerDiscount[];
  canManage: boolean;
  loadError?: boolean;
}) {
  const router = useRouter();
  const fieldId = useId();
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [requestId, setRequestId] = useState("");
  const [confirmReverse, setConfirmReverse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const value = parseDiscountAmount(amount);
  const validation = validateDiscountAmount(value, openAmount);
  const total = discounts.filter((discount) => !discount.reversed_at).reduce((sum, discount) => sum + Number(discount.amount), 0);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (validation) return setError(validation);
    setError(null);
    setSuccess(null);
    setPending(true);
      try {
        const result = await applyCustomerDiscount({ customerId, amount: value, note, requestId });
        if (result.error) return setError(result.error);
        setEditing(false);
        setAmount("");
        setNote("");
        setSuccess("Desconto aplicado ao saldo devedor.");
        router.refresh();
      } catch {
        setError("Não foi possível confirmar o desconto. Tente novamente para verificar o mesmo lançamento.");
      } finally {
        setPending(false);
      }
  }

  async function reverse(discountId: string) {
    setError(null);
    setSuccess(null);
    setPending(true);
      try {
        const result = await reverseCustomerDiscount({ customerId, discountId });
        if (result.error) return setError(result.error);
        setConfirmReverse(null);
        setSuccess("Desconto estornado. O valor voltou ao saldo devedor.");
        router.refresh();
      } catch {
        setError("Não foi possível confirmar o estorno. Tente novamente.");
      } finally {
        setPending(false);
      }
  }

  return (
    <section className="card" aria-label="Descontos do cliente">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-[15px] font-bold text-slate-900"><BadgeMinus size={18} className="text-brand-600" /> Descontos</h2>
          <p className="mt-1 text-xs text-slate-500">Abatimentos da dívida, separados dos pagamentos recebidos.</p>
        </div>
        {canManage && !editing && <button type="button" disabled={pending || loadError || openAmount <= 0} className="btn-secondary px-4 py-2.5 text-sm disabled:opacity-50" onClick={() => {
          setRequestId(crypto.randomUUID()); setEditing(true); setError(null); setSuccess(null); setConfirmReverse(null);
        }}>Adicionar desconto</button>}
      </div>

      {loadError ? <p role="alert" className="mt-3 text-sm text-danger">Não foi possível carregar os descontos. Atualize a página para tentar novamente.</p> : <>
        {total > 0 && <p className="mt-3 text-sm font-semibold text-brand-700">Total de descontos: {formatCurrency(total)}</p>}
        {editing && <form onSubmit={save} className="mt-4 space-y-3 rounded-xl bg-surface-muted p-3">
          <p className="text-sm text-slate-600">Saldo atual: <strong>{formatCurrency(openAmount)}</strong></p>
          <div>
            <label htmlFor={`${fieldId}-amount`} className="mb-1 block text-xs font-semibold text-slate-700">Valor do desconto (R$)</label>
            <input id={`${fieldId}-amount`} type="text" inputMode="decimal" autoFocus required disabled={pending} placeholder="Ex.: 50,00" value={amount} onChange={(event) => { setAmount(event.target.value); setError(null); }} className="input-field w-full" />
          </div>
          <div>
            <label htmlFor={`${fieldId}-note`} className="mb-1 block text-xs font-semibold text-slate-700">Motivo (opcional)</label>
            <input id={`${fieldId}-note`} maxLength={240} disabled={pending} placeholder="Ex.: acordo para quitação" value={note} onChange={(event) => setNote(event.target.value)} className="input-field w-full" />
          </div>
          {!validation && <p className="text-sm font-semibold text-brand-700">Saldo após desconto: {formatCurrency(Math.max(0, (Math.round(openAmount * 100) - Math.round(value * 100)) / 100))}</p>}
          <p className="text-xs text-slate-500">O desconto será abatido das parcelas com vencimento mais antigo.</p>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={pending} className="btn-primary px-4 py-2.5 text-sm disabled:opacity-50">{pending ? "Aplicando..." : "Aplicar desconto"}</button>
            <button type="button" disabled={pending} onClick={() => { setEditing(false); setError(null); }} className="btn-secondary px-4 py-2.5 text-sm">Cancelar</button>
          </div>
        </form>}
        {!editing && openAmount <= 0 && canManage && <p className="mt-3 text-xs text-slate-500">Este cliente não tem saldo devedor para receber desconto.</p>}
        {discounts.length === 0 ? <p className="mt-3 text-sm text-slate-500">Nenhum desconto registrado.</p> : <ul className="mt-3 divide-y divide-slate-100">
          {discounts.map((discount) => <li key={discount.id} className="py-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className={`text-sm font-bold ${discount.reversed_at ? "text-slate-400 line-through" : "text-brand-700"}`}>{formatCurrency(Number(discount.amount))}</p>
                <p className="mt-0.5 text-xs text-slate-500">{discountDate(discount.created_at)}</p>
                {discount.note && <p className="mt-1 break-words text-xs text-slate-600">{discount.note}</p>}
                {discount.reversed_at && <p className="mt-1 text-xs text-slate-500">Estornado em {discountDate(discount.reversed_at)}</p>}
              </div>
              {canManage && !discount.reversed_at && !editing && <button type="button" disabled={pending} onClick={() => { setConfirmReverse(discount.id); setError(null); setSuccess(null); }} className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600"><RotateCcw size={13} /> Estornar</button>}
            </div>
            {confirmReverse === discount.id && <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs text-amber-800">Estornar {formatCurrency(Number(discount.amount))}? Esse valor voltará à dívida do cliente.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" disabled={pending} onClick={() => reverse(discount.id)} className="btn-primary px-3 py-2 text-xs disabled:opacity-50">{pending ? "Estornando..." : "Confirmar estorno"}</button>
                <button type="button" disabled={pending} onClick={() => setConfirmReverse(null)} className="btn-secondary px-3 py-2 text-xs">Cancelar</button>
              </div>
            </div>}
          </li>)}
        </ul>}
      </>}
      {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
      {success && <p role="status" className="mt-3 text-sm text-success">{success}</p>}
    </section>
  );
}
