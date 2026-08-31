import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Pencil, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { DeleteButton } from "@/components/ui/DeleteButton";
import { AddVariantForm } from "@/components/products/AddVariantForm";
import { DeleteVariantButton } from "@/components/products/DeleteVariantButton";
import { formatCurrency } from "@/utils/format";
import { deleteProduct, addVariant, deleteVariant } from "@/app/(app)/estoque/produtos/actions";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: product } = await supabase.from("products").select("*").eq("id", params.id).single();
  if (!product) notFound();

  const { data: variants } = await supabase
    .from("product_variants")
    .select("*")
    .eq("product_id", params.id)
    .order("variant_name", { ascending: true });

  const totalStock = (variants ?? []).reduce((sum, v) => sum + v.stock_quantity, 0);
  const totalValue = (variants ?? []).reduce(
    (sum, v) => sum + v.stock_quantity * Number(v.cost_price ?? product.cost_price),
    0
  );

  const boundDeleteVariant = deleteVariant.bind(null, product.id);

  return (
    <div className="space-y-4">
      <Link href="/estoque/produtos" className="inline-flex items-center gap-1 text-[14px] font-medium text-slate-500">
        <ChevronLeft size={18} />
        Produtos
      </Link>

      <div className="card">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-slate-900">
              {product.name}
              {!product.is_active && (
                <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                  Inativo
                </span>
              )}
            </h1>
            {(product.category || product.brand) && (
              <p className="text-[13px] text-slate-500">
                {[product.category, product.brand].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
          <Link
            href={`/estoque/produtos/${product.id}/editar`}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-surface-muted text-slate-500"
          >
            <Pencil size={16} />
          </Link>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-surface-muted px-3 py-2.5">
            <p className="text-[11px] font-medium text-slate-500">Custo</p>
            <p className="mt-0.5 text-[14px] font-bold text-slate-900">{formatCurrency(Number(product.cost_price))}</p>
          </div>
          <div className="rounded-xl bg-surface-muted px-3 py-2.5">
            <p className="text-[11px] font-medium text-slate-500">Venda</p>
            <p className="mt-0.5 text-[14px] font-bold text-slate-900">{formatCurrency(Number(product.sale_price))}</p>
          </div>
          <div className="rounded-xl bg-surface-muted px-3 py-2.5">
            <p className="text-[11px] font-medium text-slate-500">Em estoque</p>
            <p className="mt-0.5 text-[14px] font-bold text-slate-900">{totalStock} un.</p>
          </div>
        </div>

        {product.description && <p className="mt-4 text-sm text-slate-600">{product.description}</p>}
      </div>

      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-bold text-slate-900">Variações</h2>
          <span className="text-[12px] text-slate-500">Valor em estoque: {formatCurrency(totalValue)}</span>
        </div>

        {variants && variants.length > 0 && (
          <ul className="divide-y divide-slate-100">
            {variants.map((v) => {
              const isLow = v.stock_quantity <= v.min_stock;
              return (
                <li key={v.id} className="flex items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-slate-700">{v.variant_name}</p>
                    {v.sku && <p className="text-[11px] text-slate-400">SKU: {v.sku}</p>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {isLow && <AlertTriangle size={14} className="text-warning" />}
                    <span
                      className={`text-[13px] font-bold ${isLow ? "text-warning" : "text-slate-900"}`}
                    >
                      {v.stock_quantity} un.
                    </span>
                  </div>
                  <DeleteVariantButton
                    action={boundDeleteVariant.bind(null, v.id)}
                    confirmMessage={`Excluir a variação "${v.variant_name}"?`}
                  />
                </li>
              );
            })}
          </ul>
        )}

        <AddVariantForm productId={product.id} action={addVariant} />
      </div>

      <DeleteButton
        action={deleteProduct.bind(null, product.id)}
        confirmMessage={`Excluir "${product.name}"? Essa ação não pode ser desfeita.`}
      />
    </div>
  );
}
