"use client";

import { useState, useTransition } from "react";
import { UserPlus } from "lucide-react";
import { createCollaborator } from "@/app/(app)/colaboradores/actions";

export function CollaboratorForm() {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"vendedor" | "cobrador">("vendedor");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const result = await createCollaborator({ name, username, password, phone, role });
      if (result.error) return setError(result.error);
      setSuccess(`Acesso criado. O colaborador entra com o usuário “${username.toLowerCase()}” e a senha definida.`);
      setName("");
      setUsername("");
      setPassword("");
      setPhone("");
    });
  }

  return (
    <div className="card">
      <div className="mb-4 flex items-center gap-2">
        <UserPlus size={19} className="text-brand-600" />
        <div>
          <h2 className="text-base font-bold text-slate-900">Novo colaborador</h2>
          <p className="text-xs text-slate-500">O acesso é criado na hora, sem e-mail e sem convite.</p>
        </div>
      </div>

      <form onSubmit={submit} className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="label">Nome</label>
          <input className="input-field" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do colaborador" />
        </div>
        <div>
          <label className="label">Função</label>
          <select className="input-field" value={role} onChange={(e) => setRole(e.target.value as "vendedor" | "cobrador")}>
            <option value="vendedor">Vendedor</option>
            <option value="cobrador">Cobrador</option>
          </select>
        </div>
        <div>
          <label className="label">Usuário</label>
          <input
            className="input-field"
            required
            minLength={3}
            maxLength={30}
            autoCapitalize="none"
            autoCorrect="off"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ""))}
            placeholder="ex: lucas"
          />
          <p className="mt-1 text-[11px] text-slate-400">Letras, números, ponto, hífen ou underline.</p>
        </div>
        <div>
          <label className="label">Senha</label>
          <input className="input-field" required minLength={8} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo de 8 caracteres" />
        </div>
        <div className="md:col-span-2">
          <label className="label">Telefone</label>
          <input className="input-field" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Opcional" />
        </div>

        {error && <p className="md:col-span-2 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
        {success && <p className="md:col-span-2 rounded-xl bg-success/10 px-3 py-2 text-sm font-medium text-success">{success}</p>}

        <div className="md:col-span-2">
          <button disabled={pending} className="btn-primary w-full md:w-auto">
            {pending ? "Criando acesso..." : "Cadastrar colaborador"}
          </button>
        </div>
      </form>
    </div>
  );
}
