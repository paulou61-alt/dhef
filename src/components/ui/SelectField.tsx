"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";

export type SelectOption = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
};

export function SelectField({
  value,
  onChange,
  options,
  placeholder = "Selecione uma opção",
  searchable = false,
  searchPlaceholder = "Buscar...",
  className = "",
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = options.find((option) => option.value === value);

  const filteredOptions = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("pt-BR");
    if (!term) return options;
    return options.filter((option) =>
      `${option.label} ${option.description ?? ""}`.toLocaleLowerCase("pt-BR").includes(term)
    );
  }, [options, query]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (open && searchable) {
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open, searchable]);

  function toggle() {
    if (disabled) return;
    setOpen((current) => {
      const next = !current;
      if (!next) setQuery("");
      return next;
    });
  }

  function choose(option: SelectOption) {
    if (option.disabled) return;
    onChange(option.value);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={toggle}
        className={`group flex min-h-[48px] w-full items-center justify-between gap-3 rounded-2xl border bg-white px-4 py-2.5 text-left shadow-sm outline-none transition-all duration-200 ${
          open
            ? "border-brand-500 ring-4 ring-brand-500/10 shadow-md"
            : "border-slate-200 hover:border-slate-300 hover:shadow-md"
        } ${disabled ? "cursor-not-allowed bg-slate-50 opacity-60" : "cursor-pointer"}`}
      >
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-sm font-semibold ${selected ? "text-slate-800" : "text-slate-400"}`}>
            {selected?.label ?? placeholder}
          </span>
          {selected?.description && (
            <span className="mt-0.5 block truncate text-[11px] font-medium text-slate-400">
              {selected.description}
            </span>
          )}
        </span>
        <span className={`flex h-8 w-8 flex-none items-center justify-center rounded-xl transition ${open ? "bg-brand-50 text-brand-600" : "bg-slate-50 text-slate-400 group-hover:bg-slate-100"}`}>
          <ChevronDown size={17} className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        </span>
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-[70] mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_50px_-12px_rgba(15,23,42,0.28)]">
          {searchable && (
            <div className="border-b border-slate-100 p-2.5">
              <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 ring-1 ring-inset ring-slate-200 focus-within:ring-2 focus-within:ring-brand-500/40">
                <Search size={15} className="flex-none text-slate-400" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={searchPlaceholder}
                  className="h-10 min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
                />
              </div>
            </div>
          )}

          <div role="listbox" className="max-h-72 overflow-y-auto p-1.5">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-7 text-center text-sm text-slate-400">Nenhuma opção encontrada.</div>
            ) : (
              filteredOptions.map((option) => {
                const isSelected = option.value === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    disabled={option.disabled}
                    onClick={() => choose(option)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                      isSelected
                        ? "bg-brand-50 text-brand-700"
                        : "text-slate-700 hover:bg-slate-50"
                    } ${option.disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer"}`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{option.label}</span>
                      {option.description && (
                        <span className={`mt-0.5 block truncate text-[11px] ${isSelected ? "text-brand-500" : "text-slate-400"}`}>
                          {option.description}
                        </span>
                      )}
                    </span>
                    <span className={`flex h-7 w-7 flex-none items-center justify-center rounded-lg ${isSelected ? "bg-brand-100 text-brand-600" : "text-transparent"}`}>
                      <Check size={15} strokeWidth={2.5} />
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
