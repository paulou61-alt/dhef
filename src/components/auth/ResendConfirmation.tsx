"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// O Supabase só permite um novo envio a cada 60 segundos para o mesmo e-mail.
const COOLDOWN_SECONDS = 60;

/** "Não recebeu o e-mail? Reenviar" para o link de confirmação do cadastro. */
export function ResendConfirmation({ email, startWithCooldown = false }: { email: string; startWithCooldown?: boolean }) {
  const [cooldown, setCooldown] = useState(startWithCooldown ? COOLDOWN_SECONDS : 0);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function resend() {
    setSending(true);
    setMessage(null);
    const { error } = await createClient().auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${window.location.origin}/cadastro/confirmado` },
    });
    setSending(false);

    if (error) {
      const text = error.message.toLowerCase().includes("rate limit") || error.message.toLowerCase().includes("seconds")
        ? "Aguarde um pouco antes de pedir outro e-mail."
        : "Não foi possível reenviar agora. Tente novamente em instantes.";
      setMessage({ tone: "error", text });
      return;
    }

    setMessage({ tone: "success", text: "E-mail reenviado! Confira também o spam e a aba Promoções." });
    setCooldown(COOLDOWN_SECONDS);
  }

  return (
    <div className="text-sm">
      <p className="text-slate-500">
        Não recebeu o e-mail?{" "}
        <button
          type="button"
          onClick={resend}
          disabled={sending || cooldown > 0}
          className="font-semibold text-brand-600 disabled:cursor-not-allowed disabled:text-slate-400"
        >
          {sending ? "Reenviando..." : cooldown > 0 ? `Reenviar em ${cooldown}s` : "Reenviar"}
        </button>
      </p>
      {message && (
        <p className={`mt-2 text-xs ${message.tone === "success" ? "text-success" : "text-danger"}`}>{message.text}</p>
      )}
    </div>
  );
}
