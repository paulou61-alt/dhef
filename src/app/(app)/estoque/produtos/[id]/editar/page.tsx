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

  const boundAction = async (formData: FormData) => updateProduct(product.id, formData);
  // O ProductForm em modo edição não usa variações, mas mantemos a assinatura compatível
  const wrappedAction = async (formData: FormData, _variants: unknown) => boundAction(formData);

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
      <ProductForm product={product} action={wrappedAction} isEditing />
    </div>
  );
}
