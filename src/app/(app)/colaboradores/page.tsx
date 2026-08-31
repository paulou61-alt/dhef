import { redirect } from "next/navigation";
import { ShieldCheck, UserRoundCog } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getAccessContext } from "@/lib/access";
import { CollaboratorForm } from "@/components/collaborators/CollaboratorForm";

export const dynamic = "force-dynamic";

const ROLE_LABELS = { vendedor: "Vendedor", cobrador: "Cobrador" } as const;

export default async function ColaboradoresPage() {
  const access = await getAccessContext();
  if (!access) redirect("/login");
  if (access.role !== "owner") redirect(access.role === "cobrador" ? "/cobrancas" : "/vender");

  const supabase = createClient();
  const { data: collaborators } = await supabase
    .from("collaborators")
    .select("id, name, email, phone, role, is_active, auth_user_id, invite_token, invite_expires_at, accepted_at")
    .eq("owner_id", access.ownerId)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Colaboradores</h1>
        <p className="mt-1 text-sm text-slate-500">Cadastre vendedores e cobradores com acesso individual ao sistema.</p>
      </div>

      <CollaboratorForm />

      <div className="card !p-0">
        <div className="border-b border-slate-100 px-4 py-3"><h2 className="text-sm font-bold text-slate-900">Equipe cadastrada</h2></div>
        {!collaborators || collaborators.length === 0 ? (
          <div className="py-10 text-center"><UserRoundCog className="mx-auto mb-2 text-slate-300" size={30} /><p className="text-sm text-slate-500">Nenhum colaborador cadastrado.</p></div>
        ) : (
          <div className="divide-y divide-slate-100">
            {collaborators.map((c) => {
              const activeAccess = Boolean(c.auth_user_id && c.accepted_at);
              return (
                <div key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-600">{c.name.charAt(0).toUpperCase()}</span>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-800">{c.name}</p><p className="truncate text-xs text-slate-500">{c.email}{c.phone ? ` · ${c.phone}` : ""}</p></div>
                  <div className="text-right"><span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{ROLE_LABELS[c.role as keyof typeof ROLE_LABELS]}</span><p className={`mt-1 text-[11px] font-semibold ${activeAccess ? "text-success" : "text-warning"}`}>{activeAccess ? "Acesso ativo" : "Convite pendente"}</p></div>
                  {activeAccess && <ShieldCheck size={18} className="text-success" />}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
