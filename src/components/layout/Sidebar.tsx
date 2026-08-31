"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clsx } from "clsx";
import { LogOut } from "lucide-react";
import { getMainNav, getSecondaryNav } from "@/lib/nav-items";
import type { AppRole } from "@/lib/access";
import { createClient } from "@/lib/supabase/client";

const ROLE_LABELS: Record<AppRole, string> = { owner: "Proprietário", vendedor: "Vendedor", cobrador: "Cobrador" };

export function Sidebar({ role, displayName }: { role: AppRole; displayName?: string | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const mainNav = getMainNav(role);
  const secondaryNav = getSecondaryNav(role);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const renderLink = (item: (typeof mainNav)[number]) => {
    const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
    const Icon = item.icon;
    return (
      <Link key={item.href} href={item.href} className={clsx("flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition", isActive ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-50")}>
        <Icon size={19} strokeWidth={isActive ? 2.5 : 2} />
        {item.label}
      </Link>
    );
  };

  return (
    <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-slate-200 bg-white px-4 py-6 md:flex">
      <div className="mb-6 px-2">
        <div className="flex items-center gap-2"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500 text-base font-bold text-white">V</div><span className="text-[15px] font-bold text-slate-900">Controle de Vendas</span></div>
        <div className="mt-3 rounded-xl bg-surface-muted px-3 py-2"><p className="truncate text-xs font-semibold text-slate-700">{displayName || ROLE_LABELS[role]}</p><p className="text-[11px] text-slate-400">{ROLE_LABELS[role]}</p></div>
      </div>
      <nav className="flex flex-1 flex-col gap-1">
        {mainNav.map(renderLink)}
        {secondaryNav.length > 0 && <><div className="my-3 h-px bg-slate-100" />{secondaryNav.map(renderLink)}</>}
      </nav>
      <button onClick={handleLogout} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium text-slate-500 transition hover:bg-slate-50"><LogOut size={19} />Sair</button>
    </aside>
  );
}
