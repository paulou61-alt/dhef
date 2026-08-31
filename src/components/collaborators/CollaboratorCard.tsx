"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Banknote,
  CalendarDays,
  HandCoins,
  Minus,
  Phone,
  Plus,
  ReceiptText,
  ShieldCheck,
  ShoppingBag,
  X,
} from "lucide-react";
import { addCollaboratorValeMovement } from "@/app/(app)/colaboradores/actions";
import { RemoveCollaboratorButton } from "@/components/collaborators/RemoveCollaboratorButton";
import { formatCurrency, formatDate } from "@/utils/format";

type CollaboratorRole = "vendedor" | "cobrador";
type ValeMovement = {
  id: string;
  movement_type: "vale" | "abatimento";
  amount: number;
  movement_date: string;
  notes: string | null;
  created_at: string;
};

type Props = {
  collaborator: {
    id: string;
    name: string;
    username: string;
    phone: string | null;
    role: CollaboratorRole;
  };
  hasAccess: boolean;
  salesTotal: number;
  salesCount: number;
  collectionsTotal: number;
  valeBalance: number;
  valeMovements: ValeMovement[];
};

const ROLE_LABELS: Record<CollaboratorRole, string> = {
  vendedor: "Vendedor",
  cobrador: "Cobrador",
};

export function CollaboratorCard({
  collaborator,
  hasAccess,
  salesTotal,
  salesCount,
  collectionsTotal,
  valeBalance,
  valeMovements,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"vale" | "abatimento" | null>(null);
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [movementDate, setMovementDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const recentMovements = useMemo(() => valeMovements.slice(0, 12), [valeMovements]);

  useEffect(() => {
    if (!open) return;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = oldOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function resetForm(nextMode: "vale" | "abatimento" | null = null) {
    setMode(nextMode);
    setAmount("");
    setNotes("");
    setMovementDate(new Date().toISOString().slice(0, 10));
    setError(null);
  }

  function submitMovement() {
    if (!mode) return;
    const parsedAmount = Number(amount.replace(",", "."));
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Informe um valor maior que zero.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await addCollaboratorValeMovement({
        collaboratorId: collaborator.id,
        movementType: mode,
        amount: parsedAmount,
        movementDate,
        notes,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      resetForm(null);
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 px-4 py-3.5 transition hover:bg-slate-50/80">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          aria-label={`Abrir dados de ${collaborator.name}`}
        >
          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-600">
            {collaborator.name.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-800">{collaborator.name}</p>
            <p className="truncate text-xs text-slate-500">
              @{collaborator.username}{collaborator.phone ? ` · ${collaborator.phone}` : ""}
            </p>
            <p className="mt-0.5 text-[11px] font-medium text-brand-600">Clique para ver vendas e vales</p>
          </div>
        </button>

        <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Vale em aberto</p>
            <p className={`text-sm font-bold ${valeBalance > 0 ? "text-warning" : "text-slate-500"}`}>
              {formatCurrency(valeBalance)}
            </p>
          </div>
          <div className="text-right">
            <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
              {ROLE_LABELS[collaborator.role]}
            </span>
            <p className={`mt-1 text-[11px] font-semibold ${hasAccess ? "text-success" : "text-warning"}`}>
              {hasAccess ? "Acesso ativo" : "Defina uma senha novamente"}
            </p>
          </div>
          {hasAccess ? <ShieldCheck size={18} className="text-success" /> : <AlertCircle size={18} className="text-warning" />}
          <RemoveCollaboratorButton collaboratorId={collaborator.id} collaboratorName={collaborator.name} />
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-5">
          <button
            type="button"
            aria-label="Fechar modal"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]"
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Dados de ${collaborator.name}`}
            className="relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:max-w-2xl sm:rounded-3xl"
          >
            <div className="sticky top-0 z-10 flex items-start gap-3 border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur">
              <span className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl bg-brand-50 text-lg font-bold text-brand-600">
                {collaborator.name.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-lg font-bold text-slate-900">{collaborator.name}</h2>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                    {ROLE_LABELS[collaborator.role]}
                  </span>
                </div>
                <p className="text-sm text-slate-500">@{collaborator.username}</p>
                {collaborator.phone && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                    <Phone size={13} /> {collaborator.phone}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 flex-none items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Fechar"
              >
                <X size={19} />
              </button>
            </div>

            <div className="space-y-5 p-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                    <ShoppingBag size={15} /> Saldo de vendas
                  </div>
                  <p className="mt-2 text-xl font-bold text-slate-900">{formatCurrency(salesTotal)}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">{salesCount} venda(s) registrada(s)</p>
                </div>
                <div className={`rounded-2xl border p-3.5 ${valeBalance > 0 ? "border-amber-200 bg-amber-50" : "border-slate-100 bg-slate-50"}`}>
                  <div className={`flex items-center gap-2 text-xs font-semibold ${valeBalance > 0 ? "text-amber-700" : "text-slate-500"}`}>
                    <HandCoins size={15} /> Saldo em vale
                  </div>
                  <p className={`mt-2 text-xl font-bold ${valeBalance > 0 ? "text-amber-800" : "text-slate-900"}`}>
                    {formatCurrency(valeBalance)}
                  </p>
                  <p className={`mt-0.5 text-[11px] ${valeBalance > 0 ? "text-amber-700" : "text-slate-500"}`}>
                    Valor ainda em aberto
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-white p-3.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                    <ReceiptText size={15} /> Recebido em cobranças
                  </div>
                  <p className="mt-2 text-base font-bold text-slate-900">{formatCurrency(collectionsTotal)}</p>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-white p-3.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                    <Banknote size={15} /> Movimentações de vale
                  </div>
                  <p className="mt-2 text-base font-bold text-slate-900">{valeMovements.length}</p>
                </div>
              </div>

              <section className="rounded-2xl border border-slate-100 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Vale do colaborador</h3>
                    <p className="mt-0.5 text-xs text-slate-500">Registre novos vales ou abata valores pagos/devolvidos.</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => resetForm(mode === "vale" ? null : "vale")}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-brand-700"
                    >
                      <Plus size={14} /> Registrar vale
                    </button>
                    <button
                      type="button"
                      disabled={valeBalance <= 0}
                      onClick={() => resetForm(mode === "abatimento" ? null : "abatimento")}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Minus size={14} /> Abater vale
                    </button>
                  </div>
                </div>

                {mode && (
                  <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="label">Valor *</label>
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          inputMode="decimal"
                          value={amount}
                          onChange={(event) => setAmount(event.target.value)}
                          className="input-field"
                          placeholder="0,00"
                        />
                      </div>
                      <div>
                        <label className="label">Data</label>
                        <input
                          type="date"
                          value={movementDate}
                          onChange={(event) => setMovementDate(event.target.value)}
                          className="input-field"
                        />
                      </div>
                    </div>
                    <div className="mt-3">
                      <label className="label">Observação (opcional)</label>
                      <input
                        type="text"
                        maxLength={240}
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        className="input-field"
                        placeholder={mode === "vale" ? "Ex.: Vale para combustível" : "Ex.: Abatido no pagamento"}
                      />
                    </div>
                    {error && <p className="mt-2 text-xs font-semibold text-danger">{error}</p>}
                    <div className="mt-4 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => resetForm(null)}
                        disabled={isPending}
                        className="rounded-xl px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-white"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={submitMovement}
                        disabled={isPending}
                        className="btn-primary !w-auto px-4 py-2 text-xs disabled:opacity-60"
                      >
                        {isPending ? "Salvando..." : mode === "vale" ? "Registrar vale" : "Confirmar abatimento"}
                      </button>
                    </div>
                  </div>
                )}
              </section>

              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900">Histórico de vales</h3>
                  <span className="text-xs text-slate-400">Últimos {Math.min(12, valeMovements.length)}</span>
                </div>

                {recentMovements.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 py-8 text-center">
                    <HandCoins className="mx-auto mb-2 text-slate-300" size={28} />
                    <p className="text-sm font-medium text-slate-500">Nenhum vale registrado.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-100">
                    {recentMovements.map((movement) => {
                      const isVale = movement.movement_type === "vale";
                      return (
                        <div key={movement.id} className="flex items-center gap-3 px-4 py-3">
                          <span className={`flex h-9 w-9 flex-none items-center justify-center rounded-xl ${isVale ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
                            {isVale ? <Plus size={16} /> : <Minus size={16} />}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-slate-800">{isVale ? "Vale" : "Abatimento"}</p>
                            <p className="flex items-center gap-1 text-[11px] text-slate-500">
                              <CalendarDays size={11} /> {formatDate(movement.movement_date)}
                              {movement.notes ? ` · ${movement.notes}` : ""}
                            </p>
                          </div>
                          <p className={`text-sm font-bold ${isVale ? "text-amber-700" : "text-emerald-700"}`}>
                            {isVale ? "+" : "-"}{formatCurrency(Number(movement.amount))}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
