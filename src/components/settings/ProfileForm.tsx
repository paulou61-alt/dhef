"use client";

import { useState, useTransition } from "react";
import { updateProfile } from "@/app/(app)/configuracoes/actions";
import { SelectField } from "@/components/ui/SelectField";
import { BR_STATES } from "@/utils/br-states";

export function ProfileForm({ profile, email, isOwner = false }: { profile: any; email: string; isOwner?: boolean }) {
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [businessName, setBusinessName] = useState(profile?.business_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [city, setCity] = useState(profile?.city ?? "");
  const [state, setState] = useState(profile?.state ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setMessage(null);
    const fd = new FormData();
    fd.set("full_name", fullName);
    fd.set("business_name", businessName);
    fd.set("phone", phone);
    if (isOwner) {
      fd.set("city", city);
      fd.set("state", state);
    }
    startTransition(async () => {
      const result = await updateProfile(fd);
      setMessage(result.error ?? "Configurações salvas com sucesso.");
    });
  }

  return (
    <div className="card space-y-4">
      <div><label className="label">E-mail</label><input className="input-field bg-slate-50" value={email} disabled /></div>
      <div><label className="label">Seu nome</label><input className="input-field" value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
      <div><label className="label">Nome do negócio</label><input className="input-field" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Ex.: PH Calçados" /></div>
      <div><label className="label">Telefone</label><input className="input-field" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
      {isOwner && (
        <div>
          <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-3">
            <div><label className="label" htmlFor="business-city">Cidade</label><input id="business-city" className="input-field" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ex.: Maceió" /></div>
            <div>
              <label className="label" htmlFor="business-state">Estado</label>
              <SelectField
                id="business-state"
                value={state}
                onChange={setState}
                placeholder="UF"
                searchable
                searchPlaceholder="Buscar UF..."
                options={[{ value: "", label: "Nenhum" }, ...BR_STATES.map((uf) => ({ value: uf, label: uf }))]}
              />
            </div>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Já vêm preenchidos no cadastro de novos clientes. Dá para trocar no cadastro quando precisar.</p>
        </div>
      )}
      {message && <p className={`rounded-xl px-3 py-2 text-sm ${message.includes("sucesso") ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>{message}</p>}
      <button type="button" onClick={submit} disabled={pending} className="btn-primary w-full">{pending ? "Salvando..." : "Salvar configurações"}</button>
    </div>
  );
}
