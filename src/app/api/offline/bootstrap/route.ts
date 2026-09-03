import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });

  const [customersResult, productsResult, variantsResult, installmentsResult] = await Promise.all([
    supabase
      .from("customers")
      .select("id, name, phone, whatsapp, ficha_number")
      .order("name"),
    supabase
      .from("products")
      .select("id, name, sale_price")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("product_variants")
      .select("id, product_id, variant_name, stock_quantity, sale_price")
      .order("variant_name"),
    supabase
      .from("installments")
      .select("id, amount, paid_amount, due_date, status, sales!inner(id, sale_number, customer_id, customers(id, name))")
      .in("status", ["pendente", "parcial", "vencido"])
      .order("due_date", { ascending: true })
      .limit(500),
  ]);

  const error = customersResult.error || productsResult.error || variantsResult.error || installmentsResult.error;
  if (error) {
    return NextResponse.json({ error: "Não foi possível atualizar os dados offline." }, { status: 500 });
  }

  return NextResponse.json({
    userId: user.id,
    cachedAt: new Date().toISOString(),
    customers: customersResult.data ?? [],
    products: productsResult.data ?? [],
    variants: variantsResult.data ?? [],
    installments: installmentsResult.data ?? [],
  }, { headers: { "Cache-Control": "no-store" } });
}
