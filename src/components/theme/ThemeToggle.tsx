"use client";

import { useEffect, useState } from "react";
import { clsx } from "clsx";
import { Moon, Sun } from "lucide-react";
import { THEME_STORAGE_KEY, type Theme } from "@/lib/theme";

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // armazenamento indisponível: o tema vale só até recarregar
  }
}

function useTheme(): [Theme, (theme: Theme) => void] {
  const [theme, setTheme] = useState<Theme>("light");
  useEffect(() => {
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
  }, []);
  return [theme, (next) => { applyTheme(next); setTheme(next); }];
}

/** Seletor "Claro / Escuro" do menu lateral. */
export function ThemeSwitch({ className }: { className?: string }) {
  const [theme, setTheme] = useTheme();
  const options: Array<{ value: Theme; label: string; Icon: typeof Sun }> = [
    { value: "light", label: "Claro", Icon: Sun },
    { value: "dark", label: "Escuro", Icon: Moon },
  ];
  return (
    <div role="radiogroup" aria-label="Tema" className={clsx("grid grid-cols-2 rounded-xl border border-slate-200/80 bg-slate-100/80 p-1 dark:border-white/10 dark:bg-white/5", className)}>
      {options.map(({ value, label, Icon }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(value)}
            className={clsx(
              "flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-[12.5px] font-medium transition",
              active
                ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-900/5 dark:bg-white/15 dark:text-white dark:ring-white/10"
                : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
            )}
          >
            <Icon size={14} /> {label}
          </button>
        );
      })}
    </div>
  );
}

/** Botão compacto do cabeçalho no celular: alterna entre claro e escuro. */
export function ThemeIconButton({ className }: { className?: string }) {
  const [theme, setTheme] = useTheme();
  const dark = theme === "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={dark ? "Usar tema claro" : "Usar tema escuro"}
      className={clsx("flex h-10 w-10 flex-none items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-slate-200", className)}
    >
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
