"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { getMainNav } from "@/lib/nav-items";
import type { AppRole } from "@/lib/access";

export function BottomNav({ role }: { role: AppRole }) {
  const pathname = usePathname();
  const items = getMainNav(role);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Navegação principal">
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((item) => {
          const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          const isVender = item.href === "/vender";
          return (
            <li key={item.href}>
              <Link href={item.href} className="flex flex-col items-center justify-center gap-1 py-2.5">
                {isVender ? (
                  <span className={clsx("-mt-5 flex h-11 w-11 items-center justify-center rounded-full shadow-floating transition", isActive ? "bg-brand-600" : "bg-brand-500")}><Icon size={20} className="text-white" strokeWidth={2.25} /></span>
                ) : (
                  <Icon size={20} className={isActive ? "text-brand-600" : "text-slate-400"} strokeWidth={isActive ? 2.5 : 2} />
                )}
                <span className={clsx("text-[10px] font-medium", isActive ? "text-brand-600" : "text-slate-400")}>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
