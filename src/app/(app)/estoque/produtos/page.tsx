import Link from "next/link";
import { Package, ChevronRight, ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SearchBar } from "@/components/ui/SearchBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { FabButton } from "@/components/ui/FabButton";
import { formatCurrency } from "@/utils/format";

export const dynamic = "force-dynamic";

export default async function ProdutosPage({ searchParams }: { searchParams: { q?: string } }) {
  const supabase = createClient();
  const query = searchParams.q?.trim() ?? "";

  let productsQuery = supabase
    .from("products")
    .select("id, name, sale_price, image_url, is_active, product_variants(stock_quantity)")
    .order("name", { ascending: true });

  if (query) productsQuery = productsQuery.ilike("name", `%${query}%`);

  const { data: products } = await productsQuery;

  return (
    <div className="space-y-4">
      <Link href="/estoque" className="inline-flex items-center gap-1 text-[14px] font-medium text-slate-500">
        <ChevronLeft size={18} />
        Estoque
      </Link>

      <div className="flex items-center justify-between gap-3">
        <div className="flex-1">
          <SearchBar placeholder="Buscar produto..." />
        </div>
        <Link href="/estoque/produtos/novo" className="btn-primary hidden px-5 py-3 md:flex">
          Novo produto
        </Link>
      </div>

      {!products || products.length === 0 ? (
        <EmptyState
          icon={Package}
          title={query ? "Nenhum produto encontrado" : "Nenhum produto cadastrado"}
          description={query ? "Tente buscar por outro nome." : "Cadastre seu primeiro produto para começar."}
          actionLabel={query ? undefined : "Novo produto"}
          actionHref={query ? undefined : "/estoque/produtos/novo"}
        />
      ) : (
        <ul className="card divide-y divide-slate-100 !p-0">
          {products.map((p: any) => {
            const totalStock = (p.product_variants ?? []).reduce(
              (sum: number, v: any) => sum + v.stock_quantity,
              0
            );
            return (
              <li key={p.id}>
                <Link href={`/estoque/produtos/${p.id}`} className="flex items-center gap-3 px-4 py-3.5">
                  <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-surface-muted text-slate-400">
                    <Package size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold text-slate-800">
                      {p.name}
                      {!p.is_active && (
                        <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                          Inativo
                        </span>
                      )}
                    </p>
                    <p className="text-[12px] text-slate-500">{totalStock} em estoque</p>
                  </div>
                  <span className="flex-shrink-0 text-[13px] font-bold text-slate-900">
                    {formatCurrency(Number(p.sale_price))}
                  </span>
                  <ChevronRight size={18} className="flex-shrink-0 text-slate-300" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <FabButton href="/estoque/produtos/novo" label="Novo produto" />
    </div>
  );
}
