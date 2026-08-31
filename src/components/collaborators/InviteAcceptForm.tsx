"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface InviteAcceptFormProps {
  token: string;
  name: string;
  email: string;
  role: "vendedor" | "cobrador";
}

export function InviteAcceptForm({ token, name, email, role }: InviteAcceptFormProps) {
  const router = useRouter();
  const supabase = createClient();
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasSession, setHasSession] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setHasSession(Boolean(data.user)));
  }, []);

  async function acceptInvite() {
    const { error: acceptError } = await supabase.rpc("accept_collaborator_invite", { p_token: token });
    if (acceptError) throw new Error("Não foi possível vincular este convite ao seu login.");
    router.replace(role === "cobrador" ? "/cobrancas" : "/vender");
    router.refresh();
  }

  function createAccess() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      });
      if (signUpError) {
        setError(signUpError.message.toLowerCase().includes("registered") ? "Este e-mail já possui cadastro. Use o botão Entrar e ativar." : "Não foi possível criar o acesso.");
        return;
      }
      if (data.session) {
        try { await acceptInvite(); } catch (e: any) { setError(e.message); }
        return;
      }
      setMessage("Conta criada. Confirme o e-mail recebido e depois volte a este link para entrar e ativar seu acesso.");
    });
  }

  function loginAndAccept() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
      if (loginError) return setError("Senha incorreta ou conta ainda não confirmada.");
      try { await acceptInvite(); } catch (e: any) { setError(e.message); }
    });
  }

  function activateCurrentSession() {
    setError(null);
    startTransition(async () => {
      try { await acceptInvite(); } catch (e: any) { setError(e.message); }
    });
  }

  return (
    <div className="space-y-4">
      {hasSession && <button type="button" onClick={activateCurrentSession} disabled={pending} className="btn-primary w-full">Ativar convite neste login</button>}
      <div><label className="label">E-mail</label><input className="input-field" value={email} readOnly /></div>
      <div><label className="label">Crie ou informe sua senha</label><input className="input-field" type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 8 caracteres" /></div>
      {error && <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
      {message && <p className="rounded-xl bg-success/10 px-3 py-2 text-sm text-success">{message}</p>}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={createAccess} disabled={pending || password.length < 8} className="btn-primary">Criar acesso</button>
        <button type="button" onClick={loginAndAccept} disabled={pending || password.length < 8} className="btn-secondary">Entrar e ativar</button>
      </div>
    </div>
  );
}
