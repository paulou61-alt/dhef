"use client";

import { createContext, useContext } from "react";
import type { PurchaseProduct, PurchaseVariant } from "@/components/sales/PurchaseProductSelector";

type Catalog = { products: PurchaseProduct[]; variants: PurchaseVariant[] };

const PurchaseCatalogContext = createContext<Catalog>({ products: [], variants: [] });

/**
 * Lista de produtos para a "compra junto com o recebimento".
 * Enviada uma vez por página: antes cada botão de receber levava a lista inteira,
 * e com muitas parcelas a página passava de vários megabytes.
 */
export function PurchaseCatalogProvider({ products, variants, children }: Catalog & { children: React.ReactNode }) {
  return <PurchaseCatalogContext.Provider value={{ products, variants }}>{children}</PurchaseCatalogContext.Provider>;
}

export function usePurchaseCatalog(): Catalog {
  return useContext(PurchaseCatalogContext);
}
