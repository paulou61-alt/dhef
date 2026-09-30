import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { SaleForm } from "@/components/sales/SaleForm";

export const dynamic = "force-dynamic";

export default async function VenderPage() {
  const supabase = createClient();

  const [{ data: customers }, { data: products }, { data: variants }] = await Promise.all([
    fetchAll((from, to) => supabase.from("customers").select("id, name").order("name").order("id").range(from, to)),
    fetchAll((from, to) => supabase.from("products").select("id, name, sale_price").eq("is_active", true).order("name").order("id").range(from, to)),
    fetchAll((from, to) =>
      supabase.from("product_variants").select("id, product_id, variant_name, stock_quantity, sale_price").order("variant_name").order("id").range(from, to)
    ),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Nova venda</h1>
        <p className="mt-1 text-sm text-slate-500">Selecione os produtos, o cliente e a forma de pagamento.</p>
      </div>
      <SaleForm customers={customers ?? []} products={products ?? []} variants={variants ?? []} />
    </div>
  );
}
