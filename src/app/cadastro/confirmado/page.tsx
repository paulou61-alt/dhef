"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Destino do link de confirmação enviado por e-mail. O cliente do Supabase
// troca o código da URL pela sessão automaticamente ao carregar a página.
export default function CadastroConfirmadoPage() {
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
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
      if (!done) setFailed(true);
    }, 6000);

    return () => {
      listener.subscription.unsubscribe();
      window.clearTimeout(timeout);
    };
  }, [router]);

  return (
    <div className="flex min-h-dvh flex-col justify-center px-6 py-12">
      <div className="mx-auto w-full max-w-sm text-center">
        {failed ? (
          <>
            <h1 className="text-2xl font-bold text-slate-900">Link inválido ou expirado</h1>
            <p className="mt-2 text-sm text-slate-500">
              Abra o link no mesmo aparelho em que fez o cadastro. Se sua conta já estiver confirmada, é só entrar.
            </p>
            <Link href="/login" className="btn-primary mt-6 inline-flex w-full items-center justify-center">Ir para o login</Link>
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
