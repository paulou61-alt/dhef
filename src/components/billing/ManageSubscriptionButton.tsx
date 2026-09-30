"use client";

import { useState } from "react";
import { CreditCard, Loader2 } from "lucide-react";

// Abre o portal do Stripe (trocar plano, cartão, faturas, cancelar).
export function ManageSubscriptionButton({ className = "" }: { className?: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function open() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.url) throw new Error(data.error || `Não foi possível abrir a assinatura (erro ${response.status}).`);
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível abrir a assinatura.");
      setLoading(false);
    }
  }

  return (
    <div className={className}>
      <button type="button" onClick={open} disabled={loading} className="btn-secondary inline-flex w-full items-center justify-center gap-2">
        {loading ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
        Gerenciar assinatura
      </button>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}
