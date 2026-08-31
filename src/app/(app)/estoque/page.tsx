import Link from "next/link";
import { Package, PackagePlus, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SearchBar } from "@/components/ui/SearchBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { StockList, type StockRow } from "@/components/products/StockList";
import { formatCurrency } from "@/utils/format";

export const dynamic = "force-dynamic";

export default async function EstoquePage({ searchParams }: { searchParams: { q?: string } }) {
  const supabase = createClient();
  const query = searchParams.q?.trim() ?? "";

  let variantsQuery = supabase
    .from("product_variants")
    .select("id, variant_name, stock_quantity, min_stock, cost_price, products!inner(name, cost_price, is_active)")
    .order("stock_quantity", { ascending: true });

  if (query) {
    variantsQuery = variantsQuery.ilike("products.name", `%${query}%`);
  }

  const { data: variants } = await variantsQuery;

  const rows: StockRow[] = (variants ?? []).map((v: any) => ({
    id: v.id,
    productName: v.products?.name ?? "Produto",
    variantName: v.variant_name,
    stockQuantity: v.stock_quantity,
    minStock: v.min_stock,
    costPrice: Number(v.cost_price ?? v.products?.cost_price ?? 0),
  }));

  const totalValue = rows.reduce((sum, r) => sum + r.stockQuantity * r.costPrice, 0);
  const totalUnits = rows.reduce((sum, r) => sum + r.stockQuantity, 0);
  const lowStockCount = rows.filter((r) => r.stockQuantity <= r.minStock).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="card">
          <p className="text-[11px] font-medium text-slate-500">Itens em estoque</p>
          <p className="mt-0.5 text-lg font-bold text-slate-900">{totalUnits}</p>
        </div>
        <div className="card">
          <p className="text-[11px] font-medium text-slate-500">Valor total</p>
          <p className="mt-0.5 text-lg font-bold text-slate-900">{formatCurrency(totalValue)}</p>
        </div>
        <div className="card">
          <p className="text-[11px] font-medium text-slate-500">Estoque baixo</p>
          <p className={`mt-0.5 text-lg font-bold ${lowStockCount > 0 ? "text-warning" : "text-slate-900"}`}>
            {lowStockCount}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex-1">
          <SearchBar placeholder="Buscar por produto..." />
        </div>
        <Link href="/estoque/produtos/novo" className="btn-primary hidden px-5 py-3 md:flex">
          <PackagePlus size={17} />
          Novo produto
        </Link>
      </div>

      <Link href="/estoque/produtos" className="flex items-center justify-between rounded-xl bg-brand-50 px-4 py-3 text-[14px] font-semibold text-brand-700">
        Gerenciar produtos
        <span className="text-brand-400">→</span>
      </Link>

      {lowStockCount > 0 && (
        <div className="flex items-center gap-2 rounded-xl bg-warning/10 px-4 py-3 text-[13px] font-medium text-warning">
          <AlertTriangle size={16} />
          {lowStockCount} {lowStockCount === 1 ? "item está" : "itens estão"} com estoque baixo ou zerado.
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Nenhum item em estoque"
          description="Cadastre produtos para começar a controlar seu estoque."
          actionLabel="Novo produto"
          actionHref="/estoque/produtos/novo"
        />
      ) : (
        <StockList rows={rows} />
      )}
    </div>
  );
}
