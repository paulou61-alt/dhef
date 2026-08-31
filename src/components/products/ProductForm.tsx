"use client";

import { useMemo, useState, useTransition } from "react";
import { Trash2, Wand2 } from "lucide-react";
import { maskCurrencyInput } from "@/utils/masks";
import type { Product } from "@/types/database.types";
import type { ProductFormState, VariantInput } from "@/app/(app)/estoque/produtos/actions";

interface VariantRow extends VariantInput {
  key: string;
}

function makeKey() {
  return Math.random().toString(36).slice(2, 9);
}

export function ProductForm({
  product,
  action,
  isEditing = false,
}: {
  product?: Product;
  action: (formData: FormData, variants: VariantInput[]) => Promise<ProductFormState>;
  isEditing?: boolean;
}) {
  const [costPrice, setCostPrice] = useState(
    product?.cost_price ? product.cost_price.toFixed(2).replace(".", ",") : ""
  );
  const [salePrice, setSalePrice] = useState(
    product?.sale_price ? product.sale_price.toFixed(2).replace(".", ",") : ""
  );
  const [hasVariants, setHasVariants] = useState(false);
  const [colors, setColors] = useState("");
  const [sizes, setSizes] = useState("");
  const [defaultStock, setDefaultStock] = useState("0");
  const [defaultMinStock, setDefaultMinStock] = useState("0");
  const [variantRows, setVariantRows] = useState<VariantRow[]>([
    { key: makeKey(), variant_name: "Padrão", attributes: {}, stock_quantity: 0, min_stock: 0 },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function generateVariants() {
    const colorList = colors.split(",").map((c) => c.trim()).filter(Boolean);
    const sizeList = sizes.split(",").map((s) => s.trim()).filter(Boolean);

    const stock = parseInt(defaultStock, 10) || 0;
    const minStock = parseInt(defaultMinStock, 10) || 0;

    let combinations: VariantRow[] = [];

    if (colorList.length && sizeList.length) {
      for (const color of colorList) {
        for (const size of sizeList) {
          combinations.push({
            key: makeKey(),
            variant_name: `${color} / ${size}`,
            attributes: { cor: color, tamanho: size },
            stock_quantity: stock,
            min_stock: minStock,
          });
        }
      }
    } else if (colorList.length) {
      combinations = colorList.map((color) => ({
        key: makeKey(),
        variant_name: color,
        attributes: { cor: color },
        stock_quantity: stock,
        min_stock: minStock,
      }));
    } else if (sizeList.length) {
      combinations = sizeList.map((size) => ({
        key: makeKey(),
        variant_name: size,
        attributes: { tamanho: size },
        stock_quantity: stock,
        min_stock: minStock,
      }));
    }

    if (combinations.length > 0) {
      setVariantRows(combinations);
    }
  }

  function updateVariantField(key: string, field: "stock_quantity" | "min_stock", value: string) {
    setVariantRows((rows) =>
      rows.map((r) => (r.key === key ? { ...r, [field]: parseInt(value, 10) || 0 } : r))
    );
  }

  function removeVariant(key: string) {
    setVariantRows((rows) => rows.filter((r) => r.key !== key));
  }

  const effectiveVariants = useMemo(
    () =>
      hasVariants
        ? variantRows
        : [
            {
              key: "default",
              variant_name: "Padrão",
              attributes: {},
              stock_quantity: parseInt(defaultStock, 10) || 0,
              min_stock: parseInt(defaultMinStock, 10) || 0,
            },
          ],
    [hasVariants, variantRows, defaultStock, defaultMinStock]
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (hasVariants && variantRows.length === 0) {
      setError("Gere ao menos uma variação antes de salvar.");
      return;
    }

    const formData = new FormData(e.currentTarget);
    const payload: VariantInput[] = effectiveVariants.map(({ key, ...rest }) => rest);

    startTransition(async () => {
      const result = await action(formData, payload);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <section className="card space-y-4">
        <h2 className="text-[14px] font-bold text-slate-900">Dados do produto</h2>

        <div>
          <label className="label" htmlFor="name">
            Nome *
          </label>
          <input
            id="name"
            name="name"
            required
            className="input-field"
            placeholder="Ex: Tênis Modelo X"
            defaultValue={product?.name}
          />
        </div>

        <div>
          <label className="label" htmlFor="description">
            Descrição
          </label>
          <textarea
            id="description"
            name="description"
            rows={2}
            className="input-field resize-none"
            defaultValue={product?.description ?? ""}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="category">
              Categoria
            </label>
            <input id="category" name="category" className="input-field" defaultValue={product?.category ?? ""} />
          </div>
          <div>
            <label className="label" htmlFor="brand">
              Marca
            </label>
            <input id="brand" name="brand" className="input-field" defaultValue={product?.brand ?? ""} />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="sku">
            Código / SKU
          </label>
          <input id="sku" name="sku" className="input-field" defaultValue={product?.sku ?? ""} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="cost_price">
              Preço de custo
            </label>
            <input
              id="cost_price"
              name="cost_price"
              className="input-field"
              placeholder="0,00"
              value={costPrice}
              onChange={(e) => setCostPrice(maskCurrencyInput(e.target.value))}
              inputMode="numeric"
            />
          </div>
          <div>
            <label className="label" htmlFor="sale_price">
              Preço de venda
            </label>
            <input
              id="sale_price"
              name="sale_price"
              className="input-field"
              placeholder="0,00"
              value={salePrice}
              onChange={(e) => setSalePrice(maskCurrencyInput(e.target.value))}
              inputMode="numeric"
            />
          </div>
        </div>

        {isEditing && (
          <label className="flex items-center gap-2 text-[13px] font-medium text-slate-600">
            <input
              type="checkbox"
              name="is_active"
              defaultChecked={product?.is_active ?? true}
              className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-200"
            />
            Produto ativo
          </label>
        )}
      </section>

      {!isEditing && (
        <section className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[14px] font-bold text-slate-900">Variações e estoque</h2>
            <label className="flex items-center gap-2 text-[13px] font-medium text-slate-600">
              <input
                type="checkbox"
                checked={hasVariants}
                onChange={(e) => setHasVariants(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-200"
              />
              Este produto tem variações
            </label>
          </div>

          {!hasVariants ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Estoque inicial</label>
                <input
                  type="number"
                  min={0}
                  className="input-field"
                  value={defaultStock}
                  onChange={(e) => setDefaultStock(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Estoque mínimo</label>
                <input
                  type="number"
                  min={0}
                  className="input-field"
                  value={defaultMinStock}
                  onChange={(e) => setDefaultMinStock(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Cores (separadas por vírgula)</label>
                  <input
                    className="input-field"
                    placeholder="Preto, Branco, Azul"
                    value={colors}
                    onChange={(e) => setColors(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">Tamanhos (separados por vírgula)</label>
                  <input
                    className="input-field"
                    placeholder="34, 35, 36, 37"
                    value={sizes}
                    onChange={(e) => setSizes(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Estoque inicial (por variação)</label>
                  <input
                    type="number"
                    min={0}
                    className="input-field"
                    value={defaultStock}
                    onChange={(e) => setDefaultStock(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">Estoque mínimo (por variação)</label>
                  <input
                    type="number"
                    min={0}
                    className="input-field"
                    value={defaultMinStock}
                    onChange={(e) => setDefaultMinStock(e.target.value)}
                  />
                </div>
              </div>

              <button type="button" onClick={generateVariants} className="btn-secondary w-full">
                <Wand2 size={16} />
                Gerar variações
              </button>

              {variantRows.length > 0 && (
                <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100">
                  {variantRows.map((row) => (
                    <li key={row.key} className="flex items-center gap-2 px-3 py-2.5">
                      <span className="flex-1 truncate text-[13px] font-medium text-slate-700">
                        {row.variant_name}
                      </span>
                      <input
                        type="number"
                        min={0}
                        className="w-16 rounded-lg border border-slate-200 px-2 py-1.5 text-right text-[13px]"
                        value={row.stock_quantity}
                        onChange={(e) => updateVariantField(row.key, "stock_quantity", e.target.value)}
                        aria-label="Estoque"
                      />
                      <button
                        type="button"
                        onClick={() => removeVariant(row.key)}
                        className="text-slate-400"
                      >
                        <Trash2 size={15} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
      )}

      {error && <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}

      <button type="submit" className="btn-primary w-full" disabled={isPending}>
        {isPending ? "Salvando..." : "Salvar produto"}
      </button>
    </form>
  );
}
