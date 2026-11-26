/** Quantos itens uma lista longa mostra de início; "Mostrar mais" soma outro tanto. */
export const LIST_PAGE_SIZE = 40;

/** Lê ?mostrar= da URL: nunca menos que uma página, nem um número absurdo. */
export function visibleCount(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < LIST_PAGE_SIZE) return LIST_PAGE_SIZE;
  return Math.min(parsed, 5000);
}
