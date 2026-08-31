import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ProductForm } from "@/components/products/ProductForm";
import { createProduct } from "@/app/(app)/estoque/produtos/actions";

export default function NovoProdutoPage() {
  return (
    <div className="space-y-4">
      <Link href="/estoque/produtos" className="inline-flex items-center gap-1 text-[14px] font-medium text-slate-500">
        <ChevronLeft size={18} />
        Produtos
      </Link>
      <h1 className="text-xl font-bold text-slate-900">Novo produto</h1>
      <ProductForm action={createProduct} />
    </div>
  );
}
