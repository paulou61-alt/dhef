"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { ChevronDown, Lock, LogOut, Sparkles } from "lucide-react";
import { getSidebarSections, type NavItem } from "@/lib/nav-items";
import type { AppRole } from "@/lib/access";
import type { ViewPermission } from "@/lib/permissions";
import type { Feature } from "@/lib/billing/plans";
import { useLogout } from "@/lib/use-logout";
import { BrandMark } from "@/components/brand/BrandMark";
import { ThemeSwitch } from "@/components/theme/ThemeToggle";

const ROLE_LABELS: Record<AppRole, string> = { owner: "Proprietário", vendedor: "Vendedor", cobrador: "Cobrador" };
const COLLAPSED_KEY = "cobrei:sidebar-collapsed";

export interface SidebarPlan {
  label: string;
  hint?: string | null;
  tone: "brand" | "warning" | "success";
}

export function Sidebar({
  role,
  displayName,
  viewPermissions = [],
  lockedFeatures = [],
  plan,
}: {
  role: AppRole;
  displayName?: string | null;
  viewPermissions?: ViewPermission[];
  lockedFeatures?: Feature[];
  plan?: SidebarPlan | null;
}) {
  const pathname = usePathname();
  const sections = getSidebarSections(role, viewPermissions);
  const handleLogout = useLogout();
  const [collapsed, setCollapsed] = useState<string[]>([]);

  // Lembra quais grupos o usuário deixou fechados (só neste aparelho).
  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(COLLAPSED_KEY) ?? "[]");
      if (Array.isArray(saved)) setCollapsed(saved);
    } catch {
      // armazenamento indisponível: todos os grupos abertos
    }
  }, []);

  function toggleSection(id: string) {
    setCollapsed((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
      try {
        window.localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next));
      } catch {
        // ignora
      }
      return next;
    });
  }

  const isActive = (item: NavItem) => (item.href === "/" ? pathname === "/" : pathname.startsWith(item.href));

  const renderLink = (item: NavItem) => {
    const active = isActive(item);
    const locked = Boolean(item.feature && lockedFeatures.includes(item.feature));
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        className={clsx(
          "group relative flex items-center gap-3 rounded-xl px-3 py-1.5 text-[13.5px] font-medium transition duration-200",
          active
            ? "bg-white text-brand-700 shadow-sm ring-1 ring-slate-900/5 dark:bg-white/[.08] dark:text-white dark:ring-white/10"
            : "text-slate-600 hover:bg-white/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/[.06] dark:hover:text-white"
        )}
      >
        {active && <span aria-hidden className="absolute -left-3 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-brand-500 shadow-[0_0_12px_rgba(77,127,255,.9)] dark:bg-brand-400" />}
        <span className={clsx("flex h-7 w-7 flex-none items-center justify-center rounded-lg transition", active ? "text-brand-600 dark:text-brand-300" : "text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-200")}>
          <Icon size={17} strokeWidth={active ? 2.4 : 2} />
        </span>
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        {locked && <Lock size={13} className="flex-none text-slate-400" aria-label="Não incluso no plano" />}
      </Link>
    );
  };

  const planTone = {
    brand: "border-brand-100 bg-gradient-to-br from-brand-50 to-white/60 text-brand-700 dark:from-brand-500/20 dark:to-transparent",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
    success: "border-emerald-100 bg-emerald-50 text-emerald-700",
  };

  return (
    <aside className="fixed inset-y-3 left-3 z-20 hidden w-[248px] flex-col rounded-[24px] border border-white/70 bg-white/60 px-3 py-4 shadow-[0_12px_40px_-16px_rgba(15,23,42,.18)] backdrop-blur-2xl dark:border-white/[.08] dark:bg-white/[.03] dark:shadow-none md:flex">
      <div className="mb-3 flex items-center gap-3 px-2">
        <BrandMark size={36} className="shadow-[0_8px_20px_-6px_rgba(47,91,246,.8)] rounded-[10px]" />
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold text-slate-900">Cobrei</p>
          <p className="mt-0.5 truncate text-[11px] text-slate-500">
            {displayName ? `${displayName} · ${ROLE_LABELS[role]}` : ROLE_LABELS[role]}
          </p>
        </div>
      </div>

      <nav className="-mx-3 flex flex-1 flex-col gap-3 overflow-y-auto px-3 pb-2">
        {sections.map((section) => {
          const isCollapsed = collapsed.includes(section.id) && !section.items.some(isActive);
          return (
            <div key={section.id}>
              {sections.length > 1 && (
                <button
                  type="button"
                  onClick={() => toggleSection(section.id)}
                  className="mb-1 flex w-full items-center justify-between rounded-lg px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.12em] text-slate-400 transition hover:text-slate-600"
                  aria-expanded={!isCollapsed}
                >
                  {section.label}
                  <ChevronDown size={14} className={clsx("transition-transform duration-200", isCollapsed && "-rotate-90")} />
                </button>
              )}
              {!isCollapsed && <div className="flex flex-col gap-0.5">{section.items.map(renderLink)}</div>}
            </div>
          );
        })}
      </nav>

      {plan && (
        <Link
          href="/configuracoes#plano"
          className={clsx("mb-2 block rounded-2xl border px-3 py-2.5 transition hover:shadow-sm", planTone[plan.tone])}
        >
          <p className="flex items-center gap-1.5 text-xs font-semibold"><Sparkles size={12} /> {plan.label}</p>
          {plan.hint && <p className="mt-0.5 text-[11px] opacity-80">{plan.hint}</p>}
        </Link>
      )}

      <ThemeSwitch className="mb-2" />

      <button onClick={handleLogout} className="flex items-center gap-3 rounded-xl px-3 py-2 text-[13.5px] font-medium text-slate-500 transition hover:bg-white/70 hover:text-danger dark:text-slate-400 dark:hover:bg-white/[.06]">
        <span className="flex h-7 w-7 items-center justify-center"><LogOut size={17} /></span>
        Sair
      </button>
    </aside>
  );
}
