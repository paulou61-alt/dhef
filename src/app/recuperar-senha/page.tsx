"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function RecuperarSenhaPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });

    setLoading(false);

    if (error) {
      setError("Não foi possível enviar o e-mail. Verifique o endereço digitado.");
      return;
    }

    setSent(true);
  }

  return (
    <div className="flex min-h-dvh flex-col justify-center px-6 py-12">
      <div className="mx-auto w-full max-w-sm">
        <h1 className="mb-1 text-2xl font-bold text-slate-900">Recuperar senha</h1>
        <p className="mb-8 text-sm text-slate-500">
          Enviaremos um link para redefinir sua senha.
        </p>

        {sent ? (
          <div className="space-y-4">
            <p className="rounded-xl bg-success/10 px-4 py-3 text-sm text-success">
              Enviamos um link de recuperação para <strong>{email}</strong>. Verifique sua
              caixa de entrada.
            </p>
            <Link href="/login" className="btn-secondary block w-full">
              Voltar para login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label" htmlFor="email">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                required
                className="input-field"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {error && (
              <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>
            )}

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? "Enviando..." : "Enviar link"}
            </button>

            <Link href="/login" className="block text-center text-sm text-slate-500">
              Voltar para login
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
