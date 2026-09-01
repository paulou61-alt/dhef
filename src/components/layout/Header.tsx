"use client";

import { usePathname } from "next/navigation";
import { ALL_NAV } from "@/lib/nav-items";

function getTitle(pathname: string): string {
  const all = [...ALL_NAV].sort((a, b) => b.href.length - a.href.length);
  const match = all.find((item) => item.href === "/" ? pathname === "/" : pathname.startsWith(item.href));
  return match?.label ?? "Controle de Vendas";
}

export function Header() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/85 px-4 py-3 backdrop-blur-xl md:hidden">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950 text-sm font-black text-white shadow-sm">V</div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Controle de Vendas</p>
          <h1 className="text-[16px] font-bold tracking-tight text-slate-900">{getTitle(pathname)}</h1>
        </div>
      </div>
    </header>
  );
}
