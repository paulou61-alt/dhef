import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ProductForm } from "@/components/products/ProductForm";
import { updateProduct } from "@/app/(app)/estoque/produtos/actions";

export default async function EditarProdutoPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: product } = await supabase.from("products").select("*").eq("id", params.id).single();
  if (!product) notFound();

  // Mantém a Server Action registrada pelo Next.js e fixa somente o ID do produto.
  // O ProductForm envia também o payload de variações, que é ignorado no modo edição.
  const updateAction = updateProduct.bind(null, product.id);

  return (
    <div className="space-y-4">
      <Link
        href={`/estoque/produtos/${product.id}`}
        className="inline-flex items-center gap-1 text-[14px] font-medium text-slate-500"
      >
        <ChevronLeft size={18} />
        {product.name}
      </Link>
      <h1 className="text-xl font-bold text-slate-900">Editar produto</h1>
      <ProductForm product={product} action={updateAction} isEditing />
    </div>
  );
}
