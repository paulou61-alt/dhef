"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { MAIN_NAV } from "@/lib/nav-items";

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur pb-[env(safe-area-inset-bottom)] md:hidden"
      aria-label="Navegação principal"
    >
      <ul className="grid grid-cols-5">
        {MAIN_NAV.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          const isVender = item.href === "/vender";

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className="flex flex-col items-center justify-center gap-1 py-2.5"
              >
                {isVender ? (
                  <span
                    className={clsx(
                      "-mt-5 flex h-12 w-12 items-center justify-center rounded-full shadow-floating transition",
                      isActive ? "bg-brand-600" : "bg-brand-500"
                    )}
                  >
                    <Icon size={22} className="text-white" strokeWidth={2.25} />
                  </span>
                ) : (
                  <Icon
                    size={22}
                    className={isActive ? "text-brand-600" : "text-slate-400"}
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                )}
                <span
                  className={clsx(
                    "text-[11px] font-medium",
                    isActive ? "text-brand-600" : "text-slate-400"
                  )}
                >
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
