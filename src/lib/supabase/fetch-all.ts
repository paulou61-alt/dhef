// O Supabase devolve no máximo 1.000 linhas por consulta. Quando uma lista pode
// passar disso (parcelas, vendas, clientes...), buscamos em páginas até trazer tudo.
// Sem isso, totais e listas ficam incompletos sem nenhum aviso.

const PAGE_SIZE = 1000;

type PageResult<T> = PromiseLike<{ data: T[] | null; error: unknown }>;

/**
 * Busca todas as linhas de uma consulta, página por página.
 *
 * A consulta precisa ter uma ordem estável; inclua `.order("id")` no fim:
 *   fetchAll((from, to) => supabase.from("x").select("*").order("id").range(from, to))
 */
export async function fetchAll<T>(
  buildPage: (from: number, to: number) => PageResult<T>
): Promise<{ data: T[]; error: unknown }> {
  const rows: T[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await buildPage(from, from + PAGE_SIZE - 1);
    if (error) return { data: rows, error };
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  return { data: rows, error: null };
}

/** Divide uma lista grande de ids em blocos, para filtros `.in()` não estourarem o tamanho da URL. */
export function chunk<T>(items: T[], size = 200): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}
