"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface ProductFormState {
  error?: string;
}

export interface VariantInput {
  variant_name: string;
  attributes: Record<string, string>;
  sku?: string;
  stock_quantity: number;
  min_stock: number;
}

function parseMoney(value: string | null): number {
  if (!value) return 0;
  return parseFloat(value.replace(/\./g, "").replace(",", ".")) || 0;
}

export async function createProduct(
  formData: FormData,
  variants: VariantInput[]
): Promise<ProductFormState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada. Faça login novamente." };

  const name = (formData.get("name") as string)?.trim();
  if (!name) return { error: "O nome do produto é obrigatório." };
  if (variants.length === 0) return { error: "Adicione ao menos uma variação (ou use 'Padrão')." };

  const costPrice = parseMoney(formData.get("cost_price") as string);
  const salePrice = parseMoney(formData.get("sale_price") as string);

  const { data: product, error: productError } = await supabase
    .from("products")
    .insert({
      user_id: user.id,
      name,
      description: (formData.get("description") as string) || null,
      category: (formData.get("category") as string) || null,
      brand: (formData.get("brand") as string) || null,
      sku: (formData.get("sku") as string) || null,
      cost_price: costPrice,
      sale_price: salePrice,
      is_active: true,
    })
    .select("id")
    .single();

  if (productError || !product) {
    return { error: "Não foi possível salvar o produto. Tente novamente." };
  }

  const { error: variantsError } = await supabase.from("product_variants").insert(
    variants.map((v) => ({
      user_id: user.id,
      product_id: product.id,
      variant_name: v.variant_name,
      attributes: v.attributes,
      sku: v.sku || null,
      stock_quantity: v.stock_quantity,
      min_stock: v.min_stock,
    }))
  );

  if (variantsError) {
    // rollback manual do produto já que não há transação entre as duas tabelas aqui
    await supabase.from("products").delete().eq("id", product.id);
    return { error: "Não foi possível salvar as variações. Tente novamente." };
  }

  revalidatePath("/estoque");
  revalidatePath("/estoque/produtos");
  redirect(`/estoque/produtos/${product.id}`);
}

export async function updateProduct(productId: string, formData: FormData): Promise<ProductFormState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada." };

  const name = (formData.get("name") as string)?.trim();
  if (!name) return { error: "O nome do produto é obrigatório." };

  const { error } = await supabase
    .from("products")
    .update({
      name,
      description: (formData.get("description") as string) || null,
      category: (formData.get("category") as string) || null,
      brand: (formData.get("brand") as string) || null,
      sku: (formData.get("sku") as string) || null,
      cost_price: parseMoney(formData.get("cost_price") as string),
      sale_price: parseMoney(formData.get("sale_price") as string),
      is_active: formData.get("is_active") === "on",
    })
    .eq("id", productId)
    .eq("user_id", user.id);

  if (error) return { error: "Não foi possível atualizar o produto." };

  revalidatePath("/estoque");
  revalidatePath("/estoque/produtos");
  revalidatePath(`/estoque/produtos/${productId}`);
  redirect(`/estoque/produtos/${productId}`);
}

export async function deleteProduct(productId: string): Promise<{ error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada." };

  const { error } = await supabase.from("products").delete().eq("id", productId).eq("user_id", user.id);

  if (error) {
    return {
      error: "Não é possível excluir: este produto já possui vendas registradas. Você pode desativá-lo em vez disso.",
    };
  }

  revalidatePath("/estoque");
  revalidatePath("/estoque/produtos");
  redirect("/estoque/produtos");
}

export async function addVariant(productId: string, variant: VariantInput): Promise<{ error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada." };

  const { error } = await supabase.from("product_variants").insert({
    user_id: user.id,
    product_id: productId,
    variant_name: variant.variant_name,
    attributes: variant.attributes,
    sku: variant.sku || null,
    stock_quantity: variant.stock_quantity,
    min_stock: variant.min_stock,
  });

  if (error) return { error: "Não foi possível adicionar a variação." };

  revalidatePath(`/estoque/produtos/${productId}`);
  revalidatePath("/estoque");
  return {};
}

export async function deleteVariant(productId: string, variantId: string): Promise<{ error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada." };

  const { error } = await supabase
    .from("product_variants")
    .delete()
    .eq("id", variantId)
    .eq("user_id", user.id);

  if (error) {
    return { error: "Não é possível excluir: esta variação já possui vendas registradas." };
  }

  revalidatePath(`/estoque/produtos/${productId}`);
  revalidatePath("/estoque");
  return {};
}
