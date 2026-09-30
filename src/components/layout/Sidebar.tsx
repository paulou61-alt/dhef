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
          "group flex items-center gap-3 rounded-xl px-2.5 py-2 text-[13.5px] font-medium transition duration-200",
          active
            ? "bg-gradient-to-r from-brand-50 to-brand-50/40 text-brand-700 shadow-sm ring-1 ring-brand-100"
            : "text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-sm"
        )}
      >
        <span className={clsx("flex h-8 w-8 flex-none items-center justify-center rounded-lg transition", active ? "bg-brand-500 text-white shadow-sm" : "bg-slate-100 text-slate-500 group-hover:bg-slate-200/70")}>
          <Icon size={17} strokeWidth={active ? 2.5 : 2} />
        </span>
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        {locked && <Lock size={13} className="flex-none text-slate-400" aria-label="Não incluso no plano" />}
      </Link>
    );
  };

  const planTone = {
    brand: "border-brand-100 bg-brand-50 text-brand-700",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
    success: "border-emerald-100 bg-emerald-50 text-emerald-700",
  };

  return (
    <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-slate-200/80 bg-slate-50/95 px-4 py-5 backdrop-blur-xl md:flex">
      <div className="mb-4 px-1">
        <div className="flex items-center gap-3 rounded-2xl bg-slate-950 px-3 py-3 text-white shadow-floating">
          <BrandMark size={40} className="shadow-sm" />
          <div className="min-w-0">
            <p className="truncate text-[14px] font-bold">Cobrei</p>
            <p className="mt-0.5 flex items-center gap-1 text-[10px] font-medium text-slate-400"><Sparkles size={11} /> Gestão do negócio</p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2.5 rounded-xl border border-slate-200/70 bg-white px-3 py-2.5 shadow-sm">
          <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
            {(displayName || ROLE_LABELS[role]).trim().charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-bold text-slate-800">{displayName || ROLE_LABELS[role]}</p>
            <p className="mt-0.5 text-[11px] text-slate-400">{ROLE_LABELS[role]}</p>
          </div>
        </div>
      </div>

      <nav className="-mx-1 flex flex-1 flex-col gap-3 overflow-y-auto px-1 pb-2">
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
          className={clsx("mb-2 block rounded-xl border px-3 py-2.5 transition hover:shadow-sm", planTone[plan.tone])}
        >
          <p className="text-xs font-bold">{plan.label}</p>
          {plan.hint && <p className="mt-0.5 text-[11px] opacity-80">{plan.hint}</p>}
        </Link>
      )}

      <button onClick={handleLogout} className="flex items-center gap-3 rounded-xl px-2.5 py-2 text-[13.5px] font-medium text-slate-500 transition hover:bg-white hover:text-danger hover:shadow-sm">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100"><LogOut size={17} /></span>
        Sair
      </button>
    </aside>
  );
}
