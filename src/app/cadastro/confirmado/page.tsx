"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ResendConfirmation } from "@/components/auth/ResendConfirmation";

// O Supabase devolve erros do link na URL (na busca "?error=..." ou depois do "#").
function linkError(): string | null {
  const params = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return params.get("error_code") || hash.get("error_code") || params.get("error") || hash.get("error");
}

// Destino do link de confirmação enviado por e-mail. O cliente do Supabase
// troca o código da URL pela sessão automaticamente ao carregar a página.
export default function CadastroConfirmadoPage() {
  const router = useRouter();
  const [failed, setFailed] = useState<"expired" | "invalid" | null>(null);
  const [email, setEmail] = useState("");

  useEffect(() => {
    const error = linkError();
    if (error) {
      setFailed(error === "otp_expired" ? "expired" : "invalid");
      return;
    }

    const supabase = createClient();
    let done = false;

    async function finish() {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user || done) return false;
      done = true;

      // Grava o nome do negócio informado no cadastro, se o perfil ainda não tiver.
      const businessName = typeof user.user_metadata?.business_name === "string" ? user.user_metadata.business_name : "";
      if (businessName) {
        await supabase.from("profiles").update({ business_name: businessName }).eq("id", user.id).is("business_name", null);
      }
      router.replace("/");
      router.refresh();
      return true;
    }

    const { data: listener } = supabase.auth.onAuthStateChange(() => void finish());
    void finish();
    const timeout = window.setTimeout(() => {
      if (!done) setFailed("invalid");
    }, 6000);

    return () => {
      listener.subscription.unsubscribe();
      window.clearTimeout(timeout);
    };
  }, [router]);

  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  return (
    <div className="flex min-h-dvh flex-col justify-center px-6 py-12">
      <div className="mx-auto w-full max-w-sm text-center">
        {failed ? (
          <>
            <h1 className="text-2xl font-bold text-slate-900">
              {failed === "expired" ? "Este link expirou" : "Link inválido"}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              {failed === "expired"
                ? "O link de confirmação vale por pouco tempo e só pode ser usado uma vez. Peça um novo abaixo."
                : "Abra o link no mesmo aparelho em que fez o cadastro. Se sua conta já estiver confirmada, é só entrar."}
            </p>

            <div className="mt-6 space-y-3 text-left">
              <label className="label" htmlFor="resend-email">Seu e-mail do cadastro</label>
              <input
                id="resend-email"
                type="email"
                autoComplete="email"
                autoCapitalize="none"
                className="input-field"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              {validEmail && (
                <div className="text-center">
                  <ResendConfirmation email={email.trim().toLowerCase()} />
                </div>
              )}
            </div>

            <Link href="/login" className="btn-secondary mt-6 inline-flex w-full items-center justify-center">Ir para o login</Link>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-slate-900">Confirmando sua conta...</h1>
            <p className="mt-2 text-sm text-slate-500">Só um instante.</p>
          </>
        )}
      </div>
    </div>
  );
}
