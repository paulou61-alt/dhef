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
  value: controlledValue,
  defaultValue = "",
  onChange,
  name,
  id,
  submitOnChange = false,
  options,
  placeholder = "Selecione uma opção",
  searchable = false,
  searchPlaceholder = "Buscar...",
  className = "",
  disabled = false,
}: {
  /** Valor controlado. Sem ele, o campo guarda o próprio valor a partir de defaultValue. */
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  /** Nome do campo enviado em formulários (gera um input escondido). */
  name?: string;
  id?: string;
  /** Envia o formulário assim que uma opção é escolhida. */
  submitOnChange?: boolean;
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
  // Opção destacada pelo teclado (setas); -1 = nenhuma.
  const [highlight, setHighlight] = useState(-1);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [innerValue, setInnerValue] = useState(defaultValue);
  const value = controlledValue ?? innerValue;
  const hiddenRef = useRef<HTMLInputElement>(null);

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

  // Ao filtrar, destaca a primeira opção disponível.
  useEffect(() => {
    if (!open) return;
    if (query) setHighlight(filteredOptions.findIndex((option) => !option.disabled));
  }, [query, open, filteredOptions]);

  // Mantém a opção destacada visível na lista.
  useEffect(() => {
    if (!open || highlight < 0) return;
    const element = listRef.current?.querySelectorAll<HTMLElement>("[role=option]")[highlight];
    element?.scrollIntoView({ block: "nearest" });
  }, [highlight, open]);

  function openWithKeyboard() {
    const selectedIndex = filteredOptions.findIndex((option) => option.value === value);
    setHighlight(selectedIndex >= 0 ? selectedIndex : filteredOptions.findIndex((option) => !option.disabled));
    setOpen(true);
  }

  function moveHighlight(step: number) {
    if (filteredOptions.length === 0) return;
    let next = highlight;
    for (let i = 0; i < filteredOptions.length; i += 1) {
      next = (next + step + filteredOptions.length) % filteredOptions.length;
      if (!filteredOptions[next].disabled) break;
    }
    setHighlight(next);
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (disabled) return;

    if (!open) {
      // Enter/Espaço abrem pelo clique normal do botão; as setas abrem por aqui.
      if ((event.key === "ArrowDown" || event.key === "ArrowUp") && event.target === buttonRef.current) {
        event.preventDefault();
        openWithKeyboard();
      } else if (searchable && event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey && event.key !== " " && event.target === buttonRef.current) {
        // Começar a digitar já abre a busca com a letra digitada.
        event.preventDefault();
        openWithKeyboard();
        setQuery(event.key);
      }
      return;
    }

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        moveHighlight(1);
        break;
      case "ArrowUp":
        event.preventDefault();
        moveHighlight(-1);
        break;
      case "Enter":
        event.preventDefault();
        if (highlight >= 0 && filteredOptions[highlight]) choose(filteredOptions[highlight]);
        break;
      case "Escape":
        event.preventDefault();
        setOpen(false);
        setQuery("");
        buttonRef.current?.focus();
        break;
      case "Tab":
        // Tab escolhe a opção destacada (se mudou) e segue para o próximo campo.
        if (highlight >= 0 && filteredOptions[highlight] && filteredOptions[highlight].value !== value) {
          choose(filteredOptions[highlight], false);
        } else {
          setOpen(false);
          setQuery("");
        }
        break;
    }
  }

  function toggle() {
    if (disabled) return;
    if (open) {
      setOpen(false);
      setQuery("");
    } else {
      openWithKeyboard();
    }
  }

  function choose(option: SelectOption, refocus = true) {
    if (option.disabled) return;
    setInnerValue(option.value);
    onChange?.(option.value);
    setOpen(false);
    setQuery("");
    if (refocus) buttonRef.current?.focus();
    if (submitOnChange && option.value !== value) {
      const form = rootRef.current?.closest("form");
      if (hiddenRef.current) hiddenRef.current.value = option.value;
      form?.requestSubmit();
    }
  }

  return (
    <div
      ref={rootRef}
      className={`relative ${className}`}
      onKeyDown={handleKeyDown}
      onBlur={(event) => {
        // Fecha quando o foco sai do campo (ex.: Tab para o próximo).
        if (open && !rootRef.current?.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
          setQuery("");
        }
      }}
    >
      {name && <input ref={hiddenRef} type="hidden" name={name} value={value} />}
      <button
        ref={buttonRef}
        id={id}
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

          <div ref={listRef} role="listbox" className="max-h-72 overflow-y-auto p-1.5">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-7 text-center text-sm text-slate-400">Nenhuma opção encontrada.</div>
            ) : (
              filteredOptions.map((option, index) => {
                const isSelected = option.value === value;
                const isHighlighted = index === highlight;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    disabled={option.disabled}
                    tabIndex={-1}
                    onMouseEnter={() => setHighlight(index)}
                    onClick={() => choose(option)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                      isSelected
                        ? "bg-brand-50 text-brand-700"
                        : isHighlighted
                          ? "bg-slate-100 text-slate-800"
                          : "text-slate-700 hover:bg-slate-50"
                    } ${isHighlighted ? "ring-2 ring-inset ring-brand-200" : ""} ${option.disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer"}`}
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
