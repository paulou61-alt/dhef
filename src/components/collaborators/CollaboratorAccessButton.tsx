"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Eye, EyeOff, KeyRound, Link2, UserPlus, X } from "lucide-react";
import { createCollaboratorAccess, setCollaboratorPassword } from "@/app/(app)/colaboradores/actions";

type Props = {
  collaboratorId: string;
  collaboratorName: string;
  hasAccess: boolean;
  username?: string | null;
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

export function CollaboratorAccessButton({ collaboratorId, collaboratorName, hasAccess, username: currentUsername }: Props) {
  const router = useRouter();
  const suggestedUsername = useMemo(() => suggestUsername(collaboratorName), [collaboratorName]);
  const [mode, setMode] = useState<"create" | "password" | null>(null);
  const [username, setUsername] = useState(currentUsername || suggestedUsername);
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  function close() {
    if (pending) return;
    setMode(null);
    setError(null);
    setPassword("");
    setPasswordConfirmation("");
    setShowPassword(false);
  }

  async function copyAccessLink() {
    const link = `${window.location.origin}/colaborador/login`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Não foi possível copiar o link. Use /colaborador/login.");
    }
  }

  function submitCreate() {
    if (password !== passwordConfirmation) return setError("As senhas não coincidem.");
    setError(null);
    startTransition(async () => {
      const result = await createCollaboratorAccess({
        collaboratorId,
        username: username.trim(),
        password,
      });

      if (result.error) return setError(result.error);

      setMode(null);
      setPassword("");
      setPasswordConfirmation("");
      router.refresh();
    });
  }

  function submitPassword() {
    if (password !== passwordConfirmation) return setError("As senhas não coincidem.");
    setError(null);
    startTransition(async () => {
      const result = await setCollaboratorPassword({
        collaboratorId,
        password,
      });

      if (result.error) return setError(result.error);

      setMode(null);
      setPassword("");
      setPasswordConfirmation("");
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {hasAccess ? (
          <>
            {currentUsername && (
              <span className="rounded-lg bg-slate-100 px-2.5 py-2 text-[11px] font-semibold text-slate-600">
                Usuário: {currentUsername}
              </span>
            )}
            <button
              type="button"
              onClick={copyAccessLink}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
              {copied ? "Link copiado" : "Copiar link"}
            </button>
            <button
              type="button"
              onClick={() => { setMode("password"); setError(null); }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-700 transition hover:bg-brand-100"
            >
              <KeyRound size={14} />
              Definir nova senha
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => { setMode("create"); setError(null); }}
            className="inline-flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-700 transition hover:bg-brand-100"
          >
            <UserPlus size={15} />
            Criar acesso
          </button>
        )}
      </div>

      {mode && (
        <div className="fixed inset-0 z-[95] flex items-end justify-center sm:items-center sm:p-5">
          <button type="button" aria-label="Fechar" onClick={close} className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]" />
          <div className="relative z-10 w-full rounded-t-3xl bg-white shadow-2xl sm:max-w-md sm:rounded-3xl">
            <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4">
              <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                {mode === "create" ? <UserPlus size={18} /> : <KeyRound size={18} />}
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-bold text-slate-900">
                  {mode === "create" ? "Criar acesso" : "Definir nova senha"}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  {mode === "create"
                    ? `Defina o usuário e a senha inicial de ${collaboratorName}.`
                    : `A nova senha de ${collaboratorName} passa a valer imediatamente.`}
                </p>
              </div>
              <button type="button" onClick={close} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 p-5">
              {mode === "create" && (
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
              )}

              <div>
                <label className="label" htmlFor={`access-password-${collaboratorId}`}>
                  {mode === "create" ? "Senha inicial" : "Nova senha"}
                </label>
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

              <div>
                <label className="label" htmlFor={`access-password-confirmation-${collaboratorId}`}>
                  Confirmar senha
                </label>
                <input
                  id={`access-password-confirmation-${collaboratorId}`}
                  type={showPassword ? "text" : "password"}
                  className="input-field"
                  value={passwordConfirmation}
                  onChange={(event) => setPasswordConfirmation(event.target.value)}
                  autoComplete="new-password"
                  placeholder="Digite a mesma senha novamente"
                />
              </div>

              <div className="rounded-xl bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
                <div className="flex items-center gap-1.5 font-semibold text-slate-700"><Link2 size={13} /> Link exclusivo</div>
                <p className="mt-1 break-all">/colaborador/login</p>
                <p className="mt-1 text-[11px] text-slate-500">O colaborador entra somente com usuário e senha; não precisa informar e-mail.</p>
              </div>

              {error && <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm font-medium text-danger">{error}</p>}

              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={close} disabled={pending} className="px-3 py-2 text-xs font-semibold text-slate-600 disabled:opacity-50">Cancelar</button>
                <button
                  type="button"
                  onClick={mode === "create" ? submitCreate : submitPassword}
                  disabled={pending}
                  className="btn-primary !w-auto px-4 py-2 text-xs"
                >
                  {pending ? "Salvando..." : mode === "create" ? "Criar acesso" : "Salvar nova senha"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
