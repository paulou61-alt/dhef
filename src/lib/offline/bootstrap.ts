import { getCachedValue, setCachedValue } from "@/lib/offline/db";

export interface OfflineBootstrap {
  userId: string;
  cachedAt: string;
  customers: Array<{ id: string; name: string; phone: string | null; whatsapp: string | null; ficha_number: number | null }>;
  products: Array<{ id: string; name: string; sale_price: number }>;
  variants: Array<{ id: string; product_id: string; variant_name: string; stock_quantity: number; sale_price: number | null }>;
  installments: Array<{
    id: string;
    amount: number;
    paid_amount: number;
    due_date: string;
    status: string;
    sales: {
      id: string;
      sale_number: number;
      customer_id: string | null;
      customers: { id: string; name: string } | null;
    } | null;
  }>;
}

const BOOTSTRAP_KEY = "offline:bootstrap";

export async function getOfflineBootstrap(): Promise<OfflineBootstrap | null> {
  return await getCachedValue<OfflineBootstrap>(BOOTSTRAP_KEY);
}

export async function refreshOfflineBootstrap(): Promise<OfflineBootstrap | null> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return await getOfflineBootstrap();

  const response = await fetch("/api/offline/bootstrap", {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
  });

  if (!response.ok) return await getOfflineBootstrap();
  const data = await response.json() as OfflineBootstrap;
  await setCachedValue(BOOTSTRAP_KEY, data);
  await setCachedValue("sale:reference", {
    customers: data.customers.map(({ id, name }) => ({ id, name })),
    products: data.products,
    variants: data.variants,
    cachedAt: data.cachedAt,
  });
  return data;
}
