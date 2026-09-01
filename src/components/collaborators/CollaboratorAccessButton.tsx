"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, KeyRound, UserPlus, X } from "lucide-react";
import { createCollaboratorAccess } from "@/app/(app)/colaboradores/actions";

type Props = {
  collaboratorId: string;
  collaboratorName: string;
};

function suggestUsername(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9._-]/g, "")
    .slice(0, 30);
}

export function CollaboratorAccessButton({ collaboratorId, collaboratorName }: Props) {
  const router = useRouter();
  const suggestedUsername = useMemo(() => suggestUsername(collaboratorName), [collaboratorName]);
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState(suggestedUsername);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function close() {
    if (pending) return;
    setOpen(false);
    setError(null);
    setPassword("");
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await createCollaboratorAccess({
        collaboratorId,
        username: username.trim(),
        password,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      setOpen(false);
      setPassword("");
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-700 transition hover:bg-brand-100"
      >
        <UserPlus size={15} />
        Criar acesso
      </button>

      {open && (
        <div className="fixed inset-0 z-[95] flex items-end justify-center sm:items-center sm:p-5">
          <button type="button" aria-label="Fechar" onClick={close} className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]" />
          <div className="relative z-10 w-full rounded-t-3xl bg-white shadow-2xl sm:max-w-md sm:rounded-3xl">
            <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4">
              <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <KeyRound size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-bold text-slate-900">Criar acesso</h2>
                <p className="mt-0.5 text-xs text-slate-500">Defina o login de {collaboratorName}. O cadastro principal do colaborador não será alterado.</p>
              </div>
              <button type="button" onClick={close} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div>
                <label className="label" htmlFor={`access-user-${collaboratorId}`}>Usuário</label>
                <input
                  id={`access-user-${collaboratorId}`}
                  className="input-field"
                  value={username}
                  onChange={(event) => setUsername(event.target.value.toLowerCase())}
                  autoCapitalize="none"
                  autoComplete="off"
                  placeholder="ex: joao.silva"
                />
                <p className="mt-1 text-[11px] text-slate-500">De 3 a 30 caracteres. Use letras, números, ponto, hífen ou underline.</p>
              </div>

              <div>
                <label className="label" htmlFor={`access-password-${collaboratorId}`}>Senha inicial</label>
                <div className="relative">
                  <input
                    id={`access-password-${collaboratorId}`}
                    type={showPassword ? "text" : "password"}
                    className="input-field pr-11"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="new-password"
                    placeholder="Mínimo de 8 caracteres"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
                O colaborador entrará na tela normal de login usando este <strong>usuário</strong> e a senha definida aqui.
              </div>

              {error && <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm font-medium text-danger">{error}</p>}

              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={close} disabled={pending} className="px-3 py-2 text-xs font-semibold text-slate-600 disabled:opacity-50">Cancelar</button>
                <button type="button" onClick={submit} disabled={pending} className="btn-primary !w-auto px-4 py-2 text-xs">
                  {pending ? "Criando..." : "Criar acesso"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
