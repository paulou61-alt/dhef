"use client";

import { useState, useTransition } from "react";
import { Check, Eye, UserPlus } from "lucide-react";
import { createCollaborator } from "@/app/(app)/colaboradores/actions";
import { SelectField } from "@/components/ui/SelectField";
import {
  getAllowedViewPermissions,
  getDefaultViewPermissions,
  VIEW_PERMISSION_LABELS,
  type CollaboratorRole,
  type ViewPermission,
} from "@/lib/permissions";

export function CollaboratorForm() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<CollaboratorRole>("vendedor");
  const [viewPermissions, setViewPermissions] = useState<ViewPermission[]>(getDefaultViewPermissions("vendedor"));
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function changeRole(nextRole: CollaboratorRole) {
    setRole(nextRole);
    setViewPermissions(getDefaultViewPermissions(nextRole));
  }

  function togglePermission(permission: ViewPermission) {
    setViewPermissions((current) =>
      current.includes(permission)
        ? current.filter((item) => item !== permission)
        : [...current, permission]
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const result = await createCollaborator({ name, phone, role, viewPermissions });
      if (result.error) return setError(result.error);
      setSuccess("Colaborador cadastrado com as visualizações selecionadas.");
      setName("");
      setPhone("");
      setRole("vendedor");
      setViewPermissions(getDefaultViewPermissions("vendedor"));
    });
  }

  const allowedPermissions = getAllowedViewPermissions(role);

  return (
    <div className="card">
      <div className="mb-4 flex items-center gap-2">
        <UserPlus size={19} className="text-brand-600" />
        <div>
          <h2 className="text-base font-bold text-slate-900">Novo colaborador</h2>
          <p className="text-xs text-slate-500">Cadastre os dados e escolha exatamente o que ele pode visualizar.</p>
        </div>
      </div>

      <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="label">Nome</label>
          <input className="input-field" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do colaborador" />
        </div>

        <div>
          <label className="label">Função</label>
          <SelectField
            value={role}
            onChange={(value) => changeRole(value as CollaboratorRole)}
            options={[
              { value: "vendedor", label: "Vendedor", description: "Atendimento, clientes e vendas" },
              { value: "cobrador", label: "Cobrador", description: "Clientes, fichas e cobranças" },
            ]}
          />
        </div>

        <div className="md:col-span-2">
          <label className="label">Telefone</label>
          <input className="input-field" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Opcional" />
        </div>

        <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="mb-3 flex items-start gap-2">
            <span className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-xl bg-brand-50 text-brand-600"><Eye size={16} /></span>
            <div>
              <h3 className="text-sm font-bold text-slate-900">O que meu colaborador pode ver</h3>
              <p className="mt-0.5 text-xs text-slate-500">Marque as áreas que aparecerão no menu e poderão ser abertas por este colaborador.</p>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {allowedPermissions.map((permission) => {
              const selected = viewPermissions.includes(permission);
              const info = VIEW_PERMISSION_LABELS[permission];
              return (
                <button
                  key={permission}
                  type="button"
                  onClick={() => togglePermission(permission)}
                  className={`flex items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition ${selected ? "border-brand-200 bg-brand-50 shadow-sm" : "border-slate-200 bg-white hover:border-slate-300"}`}
                >
                  <span className={`flex h-6 w-6 flex-none items-center justify-center rounded-lg border transition ${selected ? "border-brand-500 bg-brand-500 text-white" : "border-slate-300 bg-white text-transparent"}`}>
                    <Check size={14} strokeWidth={3} />
                  </span>
                  <span className="min-w-0">
                    <span className={`block text-sm font-semibold ${selected ? "text-brand-800" : "text-slate-700"}`}>{info.label}</span>
                    <span className="mt-0.5 block text-[11px] text-slate-500">{info.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {error && <p className="md:col-span-2 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
        {success && <p className="md:col-span-2 rounded-xl bg-success/10 px-3 py-2 text-sm font-medium text-success">{success}</p>}

        <div className="md:col-span-2">
          <button disabled={pending} className="btn-primary w-full md:w-auto">
            {pending ? "Cadastrando..." : "Cadastrar colaborador"}
          </button>
        </div>
      </form>
    </div>
  );
}
