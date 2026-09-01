"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { getMainNav } from "@/lib/nav-items";
import type { AppRole } from "@/lib/access";
import type { ViewPermission } from "@/lib/permissions";

export function BottomNav({ role, viewPermissions = [] }: { role: AppRole; viewPermissions?: ViewPermission[] }) {
  const pathname = usePathname();
  const items = getMainNav(role, viewPermissions);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(env(safe-area-inset-bottom)+10px)] pt-2 md:hidden" aria-label="Navegação principal">
      <div className="mx-auto max-w-xl overflow-visible rounded-2xl border border-slate-200/80 bg-white/95 shadow-floating backdrop-blur-xl">
        <ul className="grid" style={{ gridTemplateColumns: `repeat(${Math.max(items.length, 1)}, minmax(0, 1fr))` }}>
          {items.map((item) => {
            const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const Icon = item.icon;
            const isVender = item.href === "/vender";
            return (
              <li key={item.href}>
                <Link href={item.href} className="flex min-h-[58px] flex-col items-center justify-center gap-1 py-2">
                  {isVender ? (
                    <span className={clsx("-mt-6 flex h-12 w-12 items-center justify-center rounded-2xl shadow-floating transition duration-200", isActive ? "bg-brand-600" : "bg-brand-500")}><Icon size={21} className="text-white" strokeWidth={2.35} /></span>
                  ) : (
                    <span className={clsx("flex h-8 w-8 items-center justify-center rounded-lg transition", isActive ? "bg-brand-50 text-brand-600" : "text-slate-400")}><Icon size={19} strokeWidth={isActive ? 2.5 : 2} /></span>
                  )}
                  <span className={clsx("text-[10px] font-semibold", isActive ? "text-brand-600" : "text-slate-400")}>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
