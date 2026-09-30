import "server-only";

import Stripe from "stripe";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/supabase/config";

// Chaves secretas: ficam só nas variáveis de ambiente do Vercel, nunca no código.
export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

// Versão mais nova da API do Stripe, que aceita Pix em assinaturas por fatura.
// Usada só na rota do Pix; o restante continua na versão padrão da biblioteca.
const PIX_API_VERSION = "2026-08-26.dahlia";

export function getStripeForPix() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key, { apiVersion: PIX_API_VERSION as Stripe.LatestApiVersion });
}

/** Cliente do Supabase com a chave service_role, que ignora as regras de acesso. Uso exclusivo do servidor. */
export function getSupabaseAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createSupabaseClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function appUrl(request: Request) {
  return process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
}
