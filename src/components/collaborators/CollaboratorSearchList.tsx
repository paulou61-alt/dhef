"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Search, X } from "lucide-react";

type Item = { id: string; name: string; content: ReactNode };

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

export function CollaboratorSearchList({ items }: { items: Item[] }) {
  const [query, setQuery] = useState("");
  const term = normalize(query);

  const visible = useMemo(
    () => (term ? items.filter((item) => normalize(item.name).includes(term)) : items),
    [items, term]
  );

  return (
    <>
      <div className="border-b border-slate-100 px-4 py-3">
        <div className="relative">
          <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="input-field pl-10 pr-10"
            placeholder="Buscar colaborador pelo nome"
            autoComplete="off"
            aria-label="Buscar colaborador pelo nome"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
              aria-label="Limpar busca"
            >
              <X size={16} />
            </button>
          )}
        </div>
        {term && (
          <p className="mt-2 text-xs text-slate-500">
            {visible.length} colaborador(es) encontrado(s) para <span className="font-semibold text-slate-700">“{query.trim()}”</span>.
          </p>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="py-10 text-center text-sm text-slate-500">Nenhum colaborador encontrado com esse nome.</div>
      ) : (
        <div className="divide-y divide-slate-100">
          {visible.map((item) => (
            <div key={item.id}>{item.content}</div>
          ))}
        </div>
      )}
    </>
  );
}
