"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserRound, LockKeyhole } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { firstAllowedPath, normalizeViewPermissions } from "@/lib/permissions";

const COLLABORATOR_DOMAIN = "colaborador.sacoleiro.app";

export default function CollaboratorLoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const normalized = username.trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,30}$/.test(normalized)) {
      setError("Informe o usuário criado pelo proprietário.");
      return;
    }

    setLoading(true);
    const email = `${normalized}@${COLLABORATOR_DOMAIN}`;
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError || !data.user) {
      setLoading(false);
      setError("Usuário ou senha incorretos. Peça ao proprietário para definir uma nova senha, se necessário.");
      return;
    }

    const { data: collaborator, error: collaboratorError } = await supabase
      .from("collaborators")
      .select("role, is_active, view_permissions")
      .eq("auth_user_id", data.user.id)
      .maybeSingle();

    if (collaboratorError || !collaborator) {
      await supabase.auth.signOut();
      setLoading(false);
      setError("Este acesso não está vinculado a um colaborador.");
      return;
    }

    if (!collaborator.is_active) {
      await supabase.auth.signOut();
      setLoading(false);
      setError("Seu acesso de colaborador está desativado.");
      return;
    }

    const role = collaborator.role as "vendedor" | "cobrador";
    const permissions = normalizeViewPermissions(role, collaborator.view_permissions as string[] | null);
    const destination = firstAllowedPath(role, permissions);

    if (destination === "/login") {
      await supabase.auth.signOut();
      setLoading(false);
      setError("Seu acesso ainda não possui nenhuma área liberada. Fale com o proprietário.");
      return;
    }

    setLoading(false);
    router.replace(destination);
    router.refresh();
  }

  return (
    <div className="flex min-h-dvh flex-col justify-center bg-slate-50 px-6 py-12">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500 text-xl font-bold text-white">V</div>
          <h1 className="text-2xl font-bold text-slate-900">Acesso do colaborador</h1>
          <p className="mt-1 text-sm text-slate-500">Entre somente com o usuário e a senha definidos pelo proprietário.</p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label" htmlFor="collaborator-username">Usuário</label>
              <div className="relative">
                <UserRound className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                <input
                  id="collaborator-username"
                  type="text"
                  autoComplete="username"
                  autoCapitalize="none"
                  required
                  className="input-field pl-10"
                  placeholder="ex: joao.silva"
                  value={username}
                  onChange={(event) => setUsername(event.target.value.toLowerCase())}
                />
              </div>
            </div>

            <div>
              <label className="label" htmlFor="collaborator-password">Senha</label>
              <div className="relative">
                <LockKeyhole className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                <input
                  id="collaborator-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="input-field pl-10"
                  placeholder="••••••••"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
            </div>

            {error && <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? "Entrando..." : "Entrar como colaborador"}
            </button>
          </form>
        </div>

        <p className="mt-5 text-center text-xs text-slate-500">
          É proprietário? <Link href="/login" className="font-semibold text-brand-600">Acesse o login principal</Link>
        </p>
      </div>
    </div>
  );
}
