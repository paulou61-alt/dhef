"use client";

import { useState, useTransition } from "react";
import { Copy, UserPlus } from "lucide-react";
import { createCollaborator } from "@/app/(app)/colaboradores/actions";

export function CollaboratorForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"vendedor" | "cobrador">("vendedor");
  const [error, setError] = useState<string | null>(null);
  const [invitePath, setInvitePath] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInvitePath(null);
    startTransition(async () => {
      const result = await createCollaborator({ name, email, phone, role });
      if (result.error) return setError(result.error);
      setInvitePath(result.invitePath ?? null);
      setName("");
      setEmail("");
      setPhone("");
    });
  }

  async function copyInvite() {
    if (!invitePath) return;
    await navigator.clipboard.writeText(`${window.location.origin}${invitePath}`);
  }

  return (
    <div className="card">
      <div className="mb-4 flex items-center gap-2">
        <UserPlus size={19} className="text-brand-600" />
        <h2 className="text-base font-bold text-slate-900">Novo colaborador</h2>
      </div>
      <form onSubmit={submit} className="grid gap-3 md:grid-cols-2">
        <div><label className="label">Nome</label><input className="input-field" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do colaborador" /></div>
        <div><label className="label">E-mail</label><input className="input-field" required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="colaborador@email.com" /></div>
        <div><label className="label">Telefone</label><input className="input-field" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Opcional" /></div>
        <div><label className="label">Função</label><select className="input-field" value={role} onChange={(e) => setRole(e.target.value as "vendedor" | "cobrador")}><option value="vendedor">Vendedor</option><option value="cobrador">Cobrador</option></select></div>
        {error && <p className="md:col-span-2 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
        {invitePath && <div className="md:col-span-2 rounded-xl bg-success/10 p-3"><p className="text-sm font-semibold text-success">Colaborador cadastrado. Envie este link para ele criar a senha:</p><div className="mt-2 flex gap-2"><input readOnly className="input-field text-xs" value={invitePath} /><button type="button" onClick={copyInvite} className="btn-secondary px-3"><Copy size={16} /> Copiar link</button></div></div>}
        <div className="md:col-span-2"><button disabled={pending} className="btn-primary w-full md:w-auto">{pending ? "Salvando..." : "Cadastrar colaborador"}</button></div>
      </form>
    </div>
  );
}
