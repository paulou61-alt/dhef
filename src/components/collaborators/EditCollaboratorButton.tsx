"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PencilLine, X } from "lucide-react";
import { updateCollaborator } from "@/app/(app)/colaboradores/actions";
import { SelectField } from "@/components/ui/SelectField";
import type { CollaboratorRole } from "@/lib/permissions";

type Props = {
  collaborator: { id: string; name: string; phone: string | null; role: CollaboratorRole };
};

export function EditCollaboratorButton({ collaborator }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(collaborator.name);
  const [phone, setPhone] = useState(collaborator.phone ?? "");
  const [role, setRole] = useState<CollaboratorRole>(collaborator.role);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function openModal() {
    setName(collaborator.name);
    setPhone(collaborator.phone ?? "");
    setRole(collaborator.role);
    setError(null);
    setOpen(true);
  }

  function close() {
    if (pending) return;
    setOpen(false);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updateCollaborator({ collaboratorId: collaborator.id, name, phone, role });
      if (result.error) return setError(result.error);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
      >
        <PencilLine size={14} />
        Editar
      </button>

      {open && (
        <div className="fixed inset-0 z-[95] flex items-end justify-center sm:items-center sm:p-5">
          <button type="button" aria-label="Fechar" onClick={close} className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]" />
          <form
            onSubmit={submit}
            role="dialog"
            aria-modal="true"
            aria-label={`Editar ${collaborator.name}`}
            className="relative z-10 w-full rounded-t-3xl bg-white shadow-2xl sm:max-w-md sm:rounded-3xl"
          >
            <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4">
              <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <PencilLine size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-bold text-slate-900">Editar colaborador</h2>
                <p className="mt-0.5 text-xs text-slate-500">Altere os dados de {collaborator.name}.</p>
              </div>
              <button type="button" onClick={close} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100" aria-label="Fechar">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div>
                <label className="label" htmlFor={`edit-name-${collaborator.id}`}>Nome</label>
                <input
                  id={`edit-name-${collaborator.id}`}
                  className="input-field"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div>
                <label className="label" htmlFor={`edit-phone-${collaborator.id}`}>Telefone</label>
                <input
                  id={`edit-phone-${collaborator.id}`}
                  className="input-field"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Opcional"
                />
              </div>

              <div>
                <label className="label">Função</label>
                <SelectField
                  value={role}
                  onChange={(value) => setRole(value as CollaboratorRole)}
                  options={[
                    { value: "vendedor", label: "Vendedor", description: "Atendimento, clientes e vendas" },
                    { value: "cobrador", label: "Cobrador", description: "Clientes, fichas e cobranças" },
                  ]}
                />
                {role !== collaborator.role && (
                  <p className="mt-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
                    Ao mudar a função, o menu do colaborador muda. Confira depois o que ele pode ver no perfil.
                  </p>
                )}
              </div>

              {error && <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm font-medium text-danger">{error}</p>}

              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={close} disabled={pending} className="px-3 py-2 text-xs font-semibold text-slate-600 disabled:opacity-50">Cancelar</button>
                <button type="submit" disabled={pending} className="btn-primary !w-auto px-4 py-2 text-xs">
                  {pending ? "Salvando..." : "Salvar alterações"}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
