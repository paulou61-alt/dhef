"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setLoading(false);
      setError(error.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : "Não foi possível entrar. Tente novamente.");
      return;
    }

    const userId = data.user?.id;
    let destination = "/";
    if (userId) {
      const { data: collaborator } = await supabase.from("collaborators").select("role, is_active").eq("auth_user_id", userId).maybeSingle();
      if (collaborator && !collaborator.is_active) {
        await supabase.auth.signOut();
        setLoading(false);
        setError("Seu acesso de colaborador está desativado.");
        return;
      }
      if (collaborator?.role === "cobrador") destination = "/cobrancas";
      if (collaborator?.role === "vendedor") destination = "/vender";
    }

    setLoading(false);
    router.push(destination);
    router.refresh();
  }

  return (
    <div className="flex min-h-dvh flex-col justify-center px-6 py-12">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500 text-xl font-bold text-white">V</div>
          <h1 className="text-2xl font-bold text-slate-900">Entrar</h1>
          <p className="mt-1 text-sm text-slate-500">Controle suas vendas de qualquer lugar</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="label" htmlFor="email">E-mail</label><input id="email" type="email" autoComplete="email" required className="input-field" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div><div className="mb-1.5 flex items-center justify-between"><label className="label mb-0" htmlFor="password">Senha</label><Link href="/recuperar-senha" className="text-[13px] font-medium text-brand-600">Esqueceu a senha?</Link></div><input id="password" type="password" autoComplete="current-password" required className="input-field" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          {error && <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={loading}>{loading ? "Entrando..." : "Entrar"}</button>
        </form>
      </div>
    </div>
  );
}
