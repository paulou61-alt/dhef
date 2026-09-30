import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { companyHasFeature } from "@/lib/billing/subscription";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  // Modo offline faz parte dos planos Profissional e Equipe.
  if (!(await companyHasFeature("offline"))) {
    return NextResponse.json({ error: "O modo offline não está incluído no plano atual." }, { status: 403 });
  }

  const [customersResult, productsResult, variantsResult, installmentsResult] = await Promise.all([
    fetchAll((from, to) =>
      supabase.from("customers").select("id, name, phone, whatsapp, ficha_number").order("name").order("id").range(from, to)
    ),
    fetchAll((from, to) =>
      supabase.from("products").select("id, name, sale_price").eq("is_active", true).order("name").order("id").range(from, to)
    ),
    fetchAll((from, to) =>
      supabase.from("product_variants").select("id, product_id, variant_name, stock_quantity, sale_price").order("variant_name").order("id").range(from, to)
    ),
    fetchAll((from, to) =>
      supabase
        .from("installments")
        .select("id, amount, paid_amount, due_date, status, sales!inner(id, sale_number, customer_id, customers(id, name))")
        .in("status", ["pendente", "parcial", "vencido"])
        .order("due_date", { ascending: true })
        .order("id")
        .range(from, to)
    ),
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
