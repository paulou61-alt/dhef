"use client";

import { useState, useTransition } from "react";
import { maskPhone, maskCEP, maskCPF, maskCurrencyInput } from "@/utils/masks";
import type { Customer } from "@/types/database.types";
import type { CustomerFormState } from "@/app/(app)/clientes/actions";

const BR_STATES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

export interface CustomerCollaboratorOption {
  id: string;
  name: string;
  role: "vendedor" | "cobrador";
}

export function CustomerForm({
  customer,
  action,
  collaborators = [],
  accessRole = "owner",
}: {
  customer?: Customer;
  action: (formData: FormData) => Promise<CustomerFormState>;
  collaborators?: CustomerCollaboratorOption[];
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

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    if (sameAsPhone) formData.set("whatsapp", phone);

    startTransition(async () => {
      const result = await action(formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <section className="card space-y-4">
        <h2 className="text-[14px] font-bold text-slate-900">Dados básicos</h2>

        <div>
          <label className="label" htmlFor="name">Nome *</label>
          <input id="name" name="name" required className="input-field" placeholder="Nome completo" defaultValue={customer?.name} />
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
            <p className="mt-1 text-[11px] text-slate-400">Essa categoria será usada para organizar a área de Fichas.</p>
          </div>
        )}

        {accessRole === "vendedor" && collaborators[0] && (
          <div className="rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-700">
            Este cliente será vinculado a <strong>{collaborators[0].name}</strong>.
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

      <section className="card space-y-4">
        <h2 className="text-[14px] font-bold text-slate-900">Outros</h2>
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
