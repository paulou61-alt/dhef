"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MailCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ResendConfirmation } from "@/components/auth/ResendConfirmation";
import { BrandMark } from "@/components/brand/BrandMark";

// E-mails deste domínio são usados internamente para o login dos colaboradores.
const COLLABORATOR_DOMAIN = "colaborador.sacoleiro.app";

function signUpError(message: string) {
  const text = message.toLowerCase();
  if (text.includes("already registered") || text.includes("already been registered")) {
    return "Este e-mail já tem uma conta. Entre com ele ou recupere a senha.";
  }
  if (text.includes("signups not allowed") || text.includes("signup is disabled")) {
    return "Os cadastros estão fechados no momento. Fale com o suporte para criar sua conta.";
  }
  if (text.includes("password")) return "Escolha uma senha mais forte, com pelo menos 8 caracteres.";
  if (text.includes("email")) return "Informe um e-mail válido.";
  if (text.includes("rate limit")) return "Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.";
  return "Não foi possível criar a conta. Tente novamente.";
}

export default function CadastroPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const normalizedEmail = email.trim().toLowerCase();
    if (!fullName.trim() || !businessName.trim()) return setError("Informe seu nome e o nome do negócio.");
    if (normalizedEmail.endsWith(`@${COLLABORATOR_DOMAIN}`)) return setError("Use o seu e-mail pessoal ou da empresa.");
    if (password.length < 8) return setError("A senha deve ter pelo menos 8 caracteres.");
    if (password !== confirm) return setError("As senhas não coincidem.");

    setLoading(true);
    const supabase = createClient();
    const { data, error: signUpFailure } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: { full_name: fullName.trim(), business_name: businessName.trim() },
        emailRedirectTo: `${window.location.origin}/cadastro/confirmado`,
      },
    });

    if (signUpFailure) {
      setLoading(false);
      return setError(signUpError(signUpFailure.message));
    }

    // Com confirmação de e-mail desligada, a conta já entra logada.
    if (data.session && data.user) {
      await supabase.from("profiles").update({ business_name: businessName.trim() }).eq("id", data.user.id);
      router.push("/");
      router.refresh();
      return;
    }

    setLoading(false);
    setSentTo(normalizedEmail);
  }

  if (sentTo) {
    return (
      <div className="flex min-h-dvh flex-col justify-center px-6 py-12">
        <div className="mx-auto w-full max-w-sm text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-success/10 text-success">
            <MailCheck size={24} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Confira seu e-mail</h1>
          <p className="mt-2 text-sm text-slate-500">
            Enviamos um link de confirmação para <span className="font-semibold text-slate-700">{sentTo}</span>.
            Abra o link <strong>neste mesmo aparelho</strong> para ativar sua conta.
          </p>
          <p className="mt-3 text-xs text-slate-400">Pode levar alguns minutos. Veja também o spam e a aba Promoções.</p>
          <div className="mt-4">
            <ResendConfirmation email={sentTo} startWithCooldown />
          </div>
          <Link href="/login" className="btn-secondary mt-6 inline-flex w-full items-center justify-center">Voltar para o login</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col justify-center px-6 py-12">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-8 text-center">
          <BrandMark size={48} className="mx-auto mb-4 shadow-sm" />
          <h1 className="text-2xl font-bold text-slate-900">Criar conta</h1>
          <p className="mt-1 text-sm text-slate-500">Cadastre seu negócio para controlar vendas, fichas e cobranças.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label" htmlFor="full_name">Seu nome</label>
            <input id="full_name" autoComplete="name" required className="input-field" placeholder="Nome completo" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="business_name">Nome do negócio</label>
            <input id="business_name" autoComplete="organization" required className="input-field" placeholder="Nome da sua loja ou empresa" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="email">E-mail</label>
            <input id="email" type="email" autoComplete="email" autoCapitalize="none" required className="input-field" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="password">Senha</label>
            <input id="password" type="password" autoComplete="new-password" required className="input-field" placeholder="Mínimo de 8 caracteres" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="confirm">Confirmar senha</label>
            <input id="confirm" type="password" autoComplete="new-password" required className="input-field" placeholder="Digite a senha novamente" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          {error && <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={loading}>{loading ? "Criando conta..." : "Criar conta"}</button>
        </form>

        <p className="mt-5 text-center text-sm text-slate-500">
          Já tem conta? <Link href="/login" className="font-semibold text-brand-600">Entrar</Link>
        </p>
      </div>
    </div>
  );
}
