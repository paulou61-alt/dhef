"use client";

import { usePathname } from "next/navigation";
import { MAIN_NAV, SECONDARY_NAV } from "@/lib/nav-items";

function getTitle(pathname: string): string {
  const all = [...MAIN_NAV, ...SECONDARY_NAV];
  const match = all.find((item) => item.href === pathname);
  return match?.label ?? "Controle de Vendas";
}

export function Header() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center border-b border-slate-200 bg-white/90 px-4 backdrop-blur md:hidden">
      <h1 className="text-[17px] font-bold text-slate-900">{getTitle(pathname)}</h1>
    </header>
  );
}
