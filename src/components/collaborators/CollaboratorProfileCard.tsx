"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Banknote, CalendarDays, Check, Eye, HandCoins, Minus, Phone, Plus, ReceiptText, ShoppingBag, X } from "lucide-react";
import { addCollaboratorValeMovement, updateCollaboratorPermissions } from "@/app/(app)/colaboradores/actions";
import { RemoveCollaboratorButton } from "@/components/collaborators/RemoveCollaboratorButton";
import { getAllowedViewPermissions, VIEW_PERMISSION_LABELS, type ViewPermission } from "@/lib/permissions";
import { formatCurrency, formatDate } from "@/utils/format";

type Role = "vendedor" | "cobrador";
type ValeMovement = { id: string; movement_type: "vale" | "abatimento"; amount: number; movement_date: string; notes: string | null; created_at: string };

type Props = {
  collaborator: { id: string; name: string; phone: string | null; role: Role };
  hasAccess: boolean;
  viewPermissions: ViewPermission[];
  salesTotal: number;
  salesCount: number;
  collectionsTotal: number;
  valeBalance: number;
  valeMovements: ValeMovement[];
};

const ROLE_LABELS: Record<Role, string> = { vendedor: "Vendedor", cobrador: "Cobrador" };

export function CollaboratorProfileCard({ collaborator, hasAccess, viewPermissions, salesTotal, salesCount, collectionsTotal, valeBalance, valeMovements }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"vale" | "abatimento" | null>(null);
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [movementDate, setMovementDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [permissions, setPermissions] = useState<ViewPermission[]>(viewPermissions);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const recentMovements = useMemo(() => valeMovements.slice(0, 10), [valeMovements]);
  const allowedPermissions = getAllowedViewPermissions(collaborator.role);
  const permissionsChanged = JSON.stringify([...permissions].sort()) !== JSON.stringify([...viewPermissions].sort());

  useEffect(() => { setPermissions(viewPermissions); }, [viewPermissions]);
  useEffect(() => {
    if (!open) return;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const esc = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", esc);
    return () => { document.body.style.overflow = old; window.removeEventListener("keydown", esc); };
  }, [open]);

  function togglePermission(permission: ViewPermission) {
    setError(null); setSuccess(null);
    setPermissions((current) => current.includes(permission) ? current.filter((item) => item !== permission) : [...current, permission]);
  }

  function savePermissions() {
    setError(null); setSuccess(null);
    startTransition(async () => {
      const result = await updateCollaboratorPermissions(collaborator.id, permissions);
      if (result.error) return setError(result.error);
      setSuccess("Visualizações atualizadas.");
      router.refresh();
    });
  }

  function resetVale(next: "vale" | "abatimento" | null) {
    setMode(next); setAmount(""); setNotes(""); setMovementDate(new Date().toISOString().slice(0, 10)); setError(null); setSuccess(null);
  }

  function submitVale() {
    if (!mode) return;
    const parsed = Number(amount.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed <= 0) return setError("Informe um valor maior que zero.");
    setError(null); setSuccess(null);
    startTransition(async () => {
      const result = await addCollaboratorValeMovement({ collaboratorId: collaborator.id, movementType: mode, amount: parsed, movementDate, notes });
      if (result.error) return setError(result.error);
      resetVale(null);
      router.refresh();
    });
  }

  return <>
    <div className="flex flex-wrap items-center gap-3 px-4 py-3.5 transition hover:bg-slate-50/80">
      <button type="button" onClick={() => setOpen(true)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-600">{collaborator.name.charAt(0).toUpperCase()}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-800">{collaborator.name}</p>
          <p className="truncate text-xs text-slate-500">{ROLE_LABELS[collaborator.role]}{collaborator.phone ? ` · ${collaborator.phone}` : ""}</p>
          <p className="mt-0.5 text-[11px] font-medium text-brand-600">Clique para ver vendas, vales e permissões</p>
        </div>
      </button>
      <div className="ml-auto text-right">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Vale em aberto</p>
        <p className={`text-sm font-bold ${valeBalance > 0 ? "text-warning" : "text-slate-500"}`}>{formatCurrency(valeBalance)}</p>
        <p className="mt-0.5 text-[10px] text-slate-400">{hasAccess ? "Acesso ao sistema ativo" : "Cadastro interno"}</p>
      </div>
      <RemoveCollaboratorButton collaboratorId={collaborator.id} collaboratorName={collaborator.name} />
    </div>

    {open && <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-5">
      <button type="button" aria-label="Fechar" onClick={() => setOpen(false)} className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]" />
      <div role="dialog" aria-modal="true" className="relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:max-w-2xl sm:rounded-3xl">
        <div className="sticky top-0 z-10 flex items-start gap-3 border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur">
          <span className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl bg-brand-50 text-lg font-bold text-brand-600">{collaborator.name.charAt(0).toUpperCase()}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-bold text-slate-900">{collaborator.name}</h2><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{ROLE_LABELS[collaborator.role]}</span></div>
            {collaborator.phone && <p className="mt-1 flex items-center gap-1 text-xs text-slate-500"><Phone size={13} />{collaborator.phone}</p>}
          </div>
          <button type="button" onClick={() => setOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100"><X size={19} /></button>
        </div>

        <div className="space-y-5 p-5">
          <div className="grid grid-cols-2 gap-3">
            <Metric icon={<ShoppingBag size={15} />} label="Saldo de vendas" value={formatCurrency(salesTotal)} helper={`${salesCount} venda(s)`} />
            <Metric icon={<HandCoins size={15} />} label="Saldo em vale" value={formatCurrency(valeBalance)} helper="Valor em aberto" warning={valeBalance > 0} />
            <Metric icon={<ReceiptText size={15} />} label="Recebido em cobranças" value={formatCurrency(collectionsTotal)} />
            <Metric icon={<Banknote size={15} />} label="Movimentações de vale" value={String(valeMovements.length)} />
          </div>

          <section className="rounded-2xl border border-slate-200 p-4">
            <div className="mb-3 flex items-start gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><Eye size={16} /></span><div><h3 className="text-sm font-bold text-slate-900">O que este colaborador pode ver</h3><p className="text-xs text-slate-500">Você pode alterar essas opções a qualquer momento.</p></div></div>
            <div className="grid gap-2 sm:grid-cols-2">
              {allowedPermissions.map((permission) => {
                const selected = permissions.includes(permission); const info = VIEW_PERMISSION_LABELS[permission];
                return <button key={permission} type="button" onClick={() => togglePermission(permission)} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left ${selected ? "border-brand-200 bg-brand-50" : "border-slate-200 bg-white"}`}>
                  <span className={`flex h-6 w-6 flex-none items-center justify-center rounded-lg border ${selected ? "border-brand-500 bg-brand-500 text-white" : "border-slate-300 text-transparent"}`}><Check size={14} strokeWidth={3} /></span>
                  <span><span className="block text-sm font-semibold text-slate-800">{info.label}</span><span className="block text-[11px] text-slate-500">{info.description}</span></span>
                </button>;
              })}
            </div>
            {permissionsChanged && <div className="mt-3 flex justify-end"><button type="button" disabled={pending} onClick={savePermissions} className="btn-primary !w-auto px-4 py-2 text-xs">{pending ? "Salvando..." : "Salvar visualizações"}</button></div>}
          </section>

          <section className="rounded-2xl border border-slate-100 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-sm font-bold text-slate-900">Vale do colaborador</h3><p className="text-xs text-slate-500">Registre novos vales ou abatimentos.</p></div><div className="flex gap-2"><button type="button" onClick={() => resetVale(mode === "vale" ? null : "vale")} className="inline-flex items-center gap-1 rounded-xl bg-brand-600 px-3 py-2 text-xs font-semibold text-white"><Plus size={14} />Registrar vale</button><button type="button" disabled={valeBalance <= 0} onClick={() => resetVale(mode === "abatimento" ? null : "abatimento")} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-40"><Minus size={14} />Abater vale</button></div></div>
            {mode && <div className="mt-4 rounded-2xl bg-slate-50 p-4"><div className="grid gap-3 sm:grid-cols-2"><div><label className="label">Valor *</label><input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="input-field" placeholder="0,00" /></div><div><label className="label">Data</label><input type="date" value={movementDate} onChange={(e) => setMovementDate(e.target.value)} className="input-field" /></div></div><div className="mt-3"><label className="label">Observação</label><input value={notes} onChange={(e) => setNotes(e.target.value)} className="input-field" placeholder="Opcional" /></div><div className="mt-3 flex justify-end gap-2"><button type="button" onClick={() => resetVale(null)} className="px-3 py-2 text-xs font-semibold text-slate-600">Cancelar</button><button type="button" onClick={submitVale} disabled={pending} className="btn-primary !w-auto px-4 py-2 text-xs">{pending ? "Salvando..." : "Confirmar"}</button></div></div>}
          </section>

          {(error || success) && <p className={`rounded-xl px-3 py-2 text-sm font-medium ${error ? "bg-danger/10 text-danger" : "bg-success/10 text-success"}`}>{error || success}</p>}

          <section><h3 className="mb-3 text-sm font-bold text-slate-900">Histórico de vales</h3>{recentMovements.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-500">Nenhum vale registrado.</div> : <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-100">{recentMovements.map((movement) => <div key={movement.id} className="flex items-center gap-3 px-4 py-3"><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${movement.movement_type === "vale" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>{movement.movement_type === "vale" ? <Plus size={16} /> : <Minus size={16} />}</span><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-800">{movement.movement_type === "vale" ? "Vale" : "Abatimento"}</p><p className="flex items-center gap-1 text-[11px] text-slate-500"><CalendarDays size={11} />{formatDate(movement.movement_date)}{movement.notes ? ` · ${movement.notes}` : ""}</p></div><p className={`text-sm font-bold ${movement.movement_type === "vale" ? "text-amber-700" : "text-emerald-700"}`}>{movement.movement_type === "vale" ? "+" : "-"} {formatCurrency(Number(movement.amount))}</p></div>)}</div>}</section>
        </div>
      </div>
    </div>}
  </>;
}

function Metric({ icon, label, value, helper, warning = false }: { icon: React.ReactNode; label: string; value: string; helper?: string; warning?: boolean }) {
  return <div className={`rounded-2xl border p-3.5 ${warning ? "border-amber-200 bg-amber-50" : "border-slate-100 bg-slate-50"}`}><div className={`flex items-center gap-2 text-xs font-semibold ${warning ? "text-amber-700" : "text-slate-500"}`}>{icon}{label}</div><p className={`mt-2 text-lg font-bold ${warning ? "text-amber-800" : "text-slate-900"}`}>{value}</p>{helper && <p className="mt-0.5 text-[11px] text-slate-500">{helper}</p>}</div>;
}
