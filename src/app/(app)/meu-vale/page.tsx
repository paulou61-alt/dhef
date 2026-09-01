import { redirect } from "next/navigation";
import { CalendarDays, HandCoins, Minus, Plus, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getAccessContext } from "@/lib/access";
import { formatCurrency, formatDate } from "@/utils/format";

export const dynamic = "force-dynamic";

type ValeMovement = {
  id: string;
  movement_type: "vale" | "abatimento";
  amount: number;
  movement_date: string;
  notes: string | null;
  created_at: string;
};

export default async function MeuValePage() {
  const access = await getAccessContext();
  if (!access) redirect("/login");
  if (access.role === "owner") redirect("/colaboradores");
  if (!access.collaboratorId) redirect("/login");

  const supabase = createClient();
  const { data } = await supabase
    .from("collaborator_vale_movements")
    .select("id, movement_type, amount, movement_date, notes, created_at")
    .eq("collaborator_id", access.collaboratorId)
    .order("movement_date", { ascending: false })
    .order("created_at", { ascending: false });

  const movements = (data ?? []) as ValeMovement[];
  const totalVales = movements
    .filter((movement) => movement.movement_type === "vale")
    .reduce((sum, movement) => sum + Number(movement.amount ?? 0), 0);
  const totalAbatido = movements
    .filter((movement) => movement.movement_type === "abatimento")
    .reduce((sum, movement) => sum + Number(movement.amount ?? 0), 0);
  const balance = Math.max(0, totalVales - totalAbatido);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Meu Vale</h1>
        <p className="mt-1 text-sm text-slate-500">
          Consulte somente o seu saldo e o histórico das suas movimentações.
        </p>
      </div>

      <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-white text-emerald-600 shadow-sm">
            <ShieldCheck size={18} />
          </span>
          <div>
            <p className="text-sm font-bold text-emerald-900">Saldo individual e privado</p>
            <p className="mt-0.5 text-xs leading-5 text-emerald-700">
              Este histórico pertence somente a você. Outros colaboradores não conseguem visualizar seus vales.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-700">
            <HandCoins size={15} /> Saldo atual
          </div>
          <p className="mt-2 text-2xl font-bold text-amber-900">{formatCurrency(balance)}</p>
          <p className="mt-1 text-[11px] text-amber-700">Valor em vale ainda não abatido</p>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <Plus size={15} /> Total em vales
          </div>
          <p className="mt-2 text-xl font-bold text-slate-900">{formatCurrency(totalVales)}</p>
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700">
            <Minus size={15} /> Total abatido
          </div>
          <p className="mt-2 text-xl font-bold text-emerald-900">{formatCurrency(totalAbatido)}</p>
        </div>
      </div>

      <section className="card !p-0">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-bold text-slate-900">Histórico do meu vale</h2>
          <p className="mt-0.5 text-xs text-slate-500">Todos os lançamentos e abatimentos registrados para você.</p>
        </div>

        {movements.length === 0 ? (
          <div className="py-12 text-center">
            <HandCoins className="mx-auto mb-2 text-slate-300" size={30} />
            <p className="text-sm text-slate-500">Nenhuma movimentação de vale registrada.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {movements.map((movement) => {
              const isVale = movement.movement_type === "vale";
              return (
                <div key={movement.id} className="flex items-center gap-3 px-4 py-3.5">
                  <span className={`flex h-10 w-10 flex-none items-center justify-center rounded-xl ${isVale ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
                    {isVale ? <Plus size={17} /> : <Minus size={17} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-800">{isVale ? "Vale" : "Abatimento"}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] text-slate-500">
                      <CalendarDays size={11} />
                      {formatDate(movement.movement_date)}
                      {movement.notes ? ` · ${movement.notes}` : ""}
                    </p>
                  </div>
                  <p className={`text-sm font-bold ${isVale ? "text-amber-700" : "text-emerald-700"}`}>
                    {isVale ? "+" : "-"} {formatCurrency(Number(movement.amount))}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
