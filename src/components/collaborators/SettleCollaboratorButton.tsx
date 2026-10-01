"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleCheckBig, X } from "lucide-react";
import { getSettlementPreview, settleCollaborator, type SettlementPreview } from "@/app/(app)/colaboradores/actions";
import { formatCurrency, formatDate } from "@/utils/format";

function todayInBrazil() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

// Acerto com o colaborador: comissão do período menos os vales. Ao quitar, o saldo de vale volta a zero.
export function SettleCollaboratorButton({ collaborator }: { collaborator: { id: string; name: string } }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [periodEnd, setPeriodEnd] = useState(todayInBrazil);
  const [percent, setPercent] = useState("");
  const [preview, setPreview] = useState<SettlementPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

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

  function openModal() {
    setPeriodEnd(todayInBrazil());
    setPercent("");
    setPreview(null);
    setOpen(true);
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
                  {preview?.periodStart ? `Desde ${formatDate(preview.periodStart)} (depois do último acerto)` : "Desde o início (primeiro acerto)"}
                </p>
              </div>
              <button type="button" onClick={close} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100" aria-label="Fechar">
                <X size={18} />
              </button>
            </div>

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

              {alreadySettled && <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">Essa data já foi acertada. Escolha a partir de {formatDate(preview!.periodStart!)}.</p>}
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
            </div>
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
