"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { ALL_NAV, getSecondaryNav } from "@/lib/nav-items";
import type { AppRole } from "@/lib/access";

function getTitle(pathname: string): string {
  const all = [...ALL_NAV].sort((a, b) => b.href.length - a.href.length);
  const match = all.find((item) => item.href === "/" ? pathname === "/" : pathname.startsWith(item.href));
  return match?.label ?? "Controle de Vendas";
}

export function Header({ role }: { role: AppRole }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const secondaryItems = getSecondaryNav(role);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/85 px-4 py-3 backdrop-blur-xl md:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-slate-950 text-sm font-black text-white shadow-sm">V</div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Controle de Vendas</p>
              <h1 className="truncate text-[16px] font-bold tracking-tight text-slate-900">{getTitle(pathname)}</h1>
            </div>
          </div>

          {secondaryItems.length > 0 && (
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              className="flex h-10 w-10 flex-none items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm"
              aria-label={open ? "Fechar menu" : "Abrir menu"}
              aria-expanded={open}
            >
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
          )}
        </div>
      </header>

      {open && secondaryItems.length > 0 && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/35 backdrop-blur-[2px]"
            aria-label="Fechar menu"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-x-3 top-[72px] overflow-hidden rounded-3xl border border-slate-200 bg-white p-3 shadow-2xl">
            <div className="mb-2 flex items-center justify-between px-2 py-1">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Menu</p>
                <p className="text-sm font-bold text-slate-900">Gestão do negócio</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600"
                aria-label="Fechar menu"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {secondaryItems.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex min-h-[72px] items-center gap-3 rounded-2xl border px-3 py-3 transition ${
                      active
                        ? "border-brand-200 bg-brand-50 text-brand-700"
                        : "border-slate-200 bg-white text-slate-700"
                    }`}
                  >
                    <span className={`flex h-9 w-9 flex-none items-center justify-center rounded-xl ${active ? "bg-white" : "bg-slate-50"}`}>
                      <Icon size={18} />
                    </span>
                    <span className="min-w-0 text-[12px] font-bold leading-tight">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
