"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleCheckBig, HandCoins, X } from "lucide-react";
import { addCollaboratorValeMovement, getSettlementPreview, registerCollaboratorNoPayment, settleCollaborator, type SettlementPreview } from "@/app/(app)/colaboradores/actions";
import { formatCurrency, formatDate } from "@/utils/format";

function todayInBrazil() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

// Acerto com o colaborador: comissão do período menos os vales. Ao quitar, o saldo de vale volta a zero.
export function SettleCollaboratorButton({ collaborator, valeBalance }: { collaborator: { id: string; name: string }; valeBalance: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [periodEnd, setPeriodEnd] = useState(todayInBrazil);
  const [percent, setPercent] = useState("");
  const [preview, setPreview] = useState<SettlementPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Quitação manual: você digita quanto foi pago, sem calcular comissão.
  const [manual, setManual] = useState(false);
  const [direction, setDirection] = useState<"recebi" | "paguei">("recebi");
  const [manualAmount, setManualAmount] = useState("");
  const [manualDate, setManualDate] = useState(todayInBrazil);
  const [manualNotes, setManualNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getSettlementPreview({ collaboratorId: collaborator.id, periodEnd }).then((response) => {
      if (cancelled) return;
      setLoading(false);
      if (response.error || !response.preview) {
        setPreview(null);
        setError(response.error ?? "Não foi possível calcular o acerto.");
        return;
      }
      setPreview(response.preview);
      setPercent((current) => current || String(response.preview!.lastPercent).replace(".", ","));
    });
    return () => { cancelled = true; };
  }, [open, periodEnd, collaborator.id]);

  const parsedPercent = Number(percent.replace(",", "."));
  const validPercent = percent.trim() !== "" && Number.isFinite(parsedPercent) && parsedPercent >= 0 && parsedPercent <= 100;
  const commission = preview && validPercent ? Math.round(preview.baseAmount * parsedPercent) / 100 : 0;
  const result = preview ? Math.round((preview.valeBalance + commission) * 100) / 100 : 0;
  const alreadySettled = Boolean(preview?.periodStart && preview.periodStart > periodEnd);

  const currentBalance = preview?.valeBalance ?? valeBalance;
  // Aceita "1.234,56", "1234,56" e "1234.56".
  const parsedManual = Number(manualAmount.includes(",") ? manualAmount.replace(/\./g, "").replace(",", ".") : manualAmount);
  const validManual = Number.isFinite(parsedManual) && parsedManual > 0;
  // Ele pagando reduz o que deve (saldo sobe); você pagando reduz o que deve a ele (saldo desce).
  const balanceAfter = Math.round((currentBalance + (validManual ? (direction === "recebi" ? parsedManual : -parsedManual) : 0)) * 100) / 100;

  function openModal() {
    setPeriodEnd(todayInBrazil());
    setPercent("");
    setPreview(null);
    setManual(false);
    setError(null);
    setOpen(true);
  }

  function startManual() {
    setManual(true);
    setError(null);
    setDirection(currentBalance > 0 ? "paguei" : "recebi");
    // Começa vazio: o "Saldo depois" mostra o saldo atual e vai abatendo conforme o valor é digitado.
    setManualAmount("");
    setManualDate(todayInBrazil());
    setManualNotes("");
  }

  // Vazio ou zero: acerto sem pagamento.
  const emptyManual = manualAmount.trim() === "" || (Number.isFinite(parsedManual) && parsedManual === 0);

  function confirmManual() {
    // Sem valor: o colaborador não pagou nada e o saldo continua como está.
    if (emptyManual) {
      setError(null);
      startTransition(async () => {
        const response = await registerCollaboratorNoPayment({ collaboratorId: collaborator.id, date: manualDate, notes: manualNotes });
        if (response.error) return setError(response.error);
        setOpen(false);
        router.refresh();
      });
      return;
    }
    if (!validManual) return setError("Informe um valor válido ou deixe em branco.");
    setError(null);
    startTransition(async () => {
      const label = direction === "recebi" ? "Quitação manual · recebido do colaborador" : "Quitação manual · pago ao colaborador";
      const response = await addCollaboratorValeMovement({
        collaboratorId: collaborator.id,
        movementType: direction === "recebi" ? "abatimento" : "vale",
        amount: parsedManual,
        movementDate: manualDate,
        notes: manualNotes.trim() ? `${label} · ${manualNotes.trim()}` : label,
      });
      if (response.error) return setError(response.error);
      setOpen(false);
      router.refresh();
    });
  }

  function close() {
    if (!pending) setOpen(false);
  }

  function confirm() {
    if (!validPercent) return setError("Informe a comissão entre 0% e 100%.");
    setError(null);
    startTransition(async () => {
      const response = await settleCollaborator({ collaboratorId: collaborator.id, commissionPercent: parsedPercent, periodEnd });
      if (response.error) return setError(response.error);
      setOpen(false);
      router.refresh();
    });
  }

  const baseLabel = preview?.role === "cobrador" ? "Cobrado dos clientes no período" : "Vendido no período";

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
      >
        <CircleCheckBig size={14} />
        Quitar
      </button>

      {open && (
        <div className="fixed inset-0 z-[95] flex items-end justify-center sm:items-center sm:p-5">
          <button type="button" aria-label="Fechar" onClick={close} className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]" />
          <div role="dialog" aria-modal="true" aria-label={`Quitar ${collaborator.name}`} className="relative z-10 max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:max-w-md sm:rounded-3xl">
            <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4">
              <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <CircleCheckBig size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-bold text-slate-900">Acerto de {collaborator.name}</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  {manual
                    ? "Informe quanto foi pago, sem calcular comissão."
                    : preview?.periodStart ? `Conta o que entrou depois do último acerto (até ${formatDate(preview.periodStart)})` : "Desde o início (primeiro acerto)"}
                </p>
              </div>
              <button type="button" onClick={close} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100" aria-label="Fechar">
                <X size={18} />
              </button>
            </div>

            {manual ? (
            <div className="space-y-4 p-5">
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                <p className="text-xs text-slate-500">Saldo de vale atual</p>
                <p className={`text-lg font-bold ${currentBalance < 0 ? "text-danger" : currentBalance > 0 ? "text-success" : "text-slate-900"}`}>{formatCurrency(currentBalance)}</p>
                <p className="text-[11px] text-slate-500">{currentBalance < 0 ? "Ele está devendo a você." : currentBalance > 0 ? "Você está devendo a ele." : "Nada pendente."}</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {([["recebi", "Ele me pagou"], ["paguei", "Eu paguei a ele"]] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setDirection(value)}
                    className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${direction === value ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label" htmlFor={`manual-amount-${collaborator.id}`}>Valor</label>
                  <input id={`manual-amount-${collaborator.id}`} inputMode="decimal" value={manualAmount} onChange={(e) => setManualAmount(e.target.value)} className="input-field" placeholder="0,00" />
                </div>
                <div>
                  <label className="label" htmlFor={`manual-date-${collaborator.id}`}>Data</label>
                  <input id={`manual-date-${collaborator.id}`} type="date" value={manualDate} onChange={(e) => setManualDate(e.target.value)} className="input-field" />
                </div>
              </div>
              <div>
                <label className="label" htmlFor={`manual-notes-${collaborator.id}`}>Observação</label>
                <input id={`manual-notes-${collaborator.id}`} value={manualNotes} onChange={(e) => setManualNotes(e.target.value)} maxLength={120} className="input-field" placeholder="Opcional" />
              </div>

              <div className={`rounded-2xl px-4 py-3 ${balanceAfter < 0 ? "bg-red-50" : balanceAfter > 0 ? "bg-emerald-50" : "bg-slate-50"}`}>
                <p className="text-xs font-semibold text-slate-500">Saldo depois</p>
                <p className={`text-xl font-bold ${balanceAfter < 0 ? "text-red-800" : balanceAfter > 0 ? "text-emerald-800" : "text-slate-900"}`}>{formatCurrency(balanceAfter)}</p>
                <p className="text-[11px] text-slate-500">
                  {balanceAfter === 0 ? "Quitado." : balanceAfter < 0 ? "Ele ainda fica devendo a você." : "Você ainda fica devendo a ele."}
                </p>
              </div>

              {error && <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => { setManual(false); setError(null); }} className="btn-secondary">Voltar</button>
                <button type="button" onClick={confirmManual} disabled={pending || (!emptyManual && !validManual)} className="btn-primary disabled:opacity-50">
                  {pending ? "Salvando..." : emptyManual ? "Confirmar sem pagamento" : "Confirmar"}
                </button>
              </div>
            </div>
            ) : (
            <div className="space-y-4 p-5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label" htmlFor={`settle-end-${collaborator.id}`}>Acertar até</label>
                  <input id={`settle-end-${collaborator.id}`} type="date" max={todayInBrazil()} value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className="input-field" />
                </div>
                <div>
                  <label className="label" htmlFor={`settle-percent-${collaborator.id}`}>Comissão (%)</label>
                  <input id={`settle-percent-${collaborator.id}`} inputMode="decimal" value={percent} onChange={(e) => setPercent(e.target.value)} className="input-field" placeholder="Ex.: 10" />
                </div>
              </div>

              {loading && !preview ? (
                <p className="py-6 text-center text-sm text-slate-500">Calculando...</p>
              ) : preview ? (
                <div className="divide-y divide-slate-100 rounded-2xl border border-slate-100">
                  <Row label={baseLabel} value={formatCurrency(preview.baseAmount)} />
                  <Row label={`Comissão${validPercent ? ` (${percent.replace(".", ",")}%)` : ""}`} value={`+ ${formatCurrency(commission)}`} tone="success" />
                  <Row
                    label="Saldo de vale atual"
                    value={formatCurrency(preview.valeBalance)}
                    tone={preview.valeBalance < 0 ? "danger" : preview.valeBalance > 0 ? "success" : undefined}
                  />
                  <div className={`rounded-b-2xl px-4 py-3.5 ${result > 0 ? "bg-emerald-50" : result < 0 ? "bg-red-50" : "bg-slate-50"}`}>
                    <p className={`text-xs font-semibold ${result > 0 ? "text-emerald-700" : result < 0 ? "text-red-700" : "text-slate-500"}`}>
                      {result > 0 ? "Você paga a ele" : result < 0 ? "Ele fica devendo a você" : "Nada a pagar"}
                    </p>
                    <p className={`mt-0.5 text-2xl font-bold ${result > 0 ? "text-emerald-800" : result < 0 ? "text-red-800" : "text-slate-900"}`}>
                      {formatCurrency(Math.abs(result))}
                    </p>
                  </div>
                </div>
              ) : null}

              {alreadySettled && <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">O último acerto foi até {formatDate(preview!.periodStart!)}. Escolha essa data ou uma mais recente.</p>}
              {error && <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

              <p className="text-[11px] leading-4 text-slate-500">
                Ao confirmar, o acerto fica registrado no histórico de vales e o saldo de vale volta para R$ 0,00.
                O próximo acerto começa no dia seguinte à data escolhida.
              </p>

              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={close} className="btn-secondary">Cancelar</button>
                <button type="button" onClick={confirm} disabled={pending || !preview || alreadySettled || !validPercent} className="btn-primary disabled:opacity-50">
                  {pending ? "Quitando..." : "Confirmar quitação"}
                </button>
              </div>

              <button
                type="button"
                onClick={startManual}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 px-3 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                <HandCoins size={15} />
                Quitar manualmente
              </button>
            </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "success" | "danger" }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <span className="text-sm text-slate-600">{label}</span>
      <span className={`text-sm font-bold ${tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : "text-slate-900"}`}>{value}</span>
    </div>
  );
}
