"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clsx } from "clsx";
import { LogOut, Sparkles } from "lucide-react";
import { getMainNav, getSecondaryNav } from "@/lib/nav-items";
import type { AppRole } from "@/lib/access";
import type { ViewPermission } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/client";
import { clearOfflineStorage, listOfflineOperations } from "@/lib/offline/db";

const ROLE_LABELS: Record<AppRole, string> = { owner: "Proprietário", vendedor: "Vendedor", cobrador: "Cobrador" };

export function Sidebar({ role, displayName, viewPermissions = [] }: { role: AppRole; displayName?: string | null; viewPermissions?: ViewPermission[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const mainNav = getMainNav(role, viewPermissions);
  const secondaryNav = getSecondaryNav(role);

  async function handleLogout() {
    const operations = await listOfflineOperations().catch(() => []);
    if (operations.length > 0) {
      window.alert(
        `Existem ${operations.length} alteração${operations.length === 1 ? "" : "ões"} ainda não sincronizada${operations.length === 1 ? "" : "s"}. Conecte-se à internet e aguarde a sincronização antes de sair da conta para não perder esses dados.`
      );
      return;
    }

    await clearOfflineStorage().catch(() => undefined);
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const renderLink = (item: (typeof mainNav)[number]) => {
    const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        className={clsx(
          "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition duration-200",
          isActive
            ? "bg-gradient-to-r from-brand-50 to-brand-50/40 text-brand-700 shadow-sm ring-1 ring-brand-100"
            : "text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-sm"
        )}
      >
        <span className={clsx("flex h-8 w-8 items-center justify-center rounded-lg transition", isActive ? "bg-brand-500 text-white shadow-sm" : "bg-slate-100 text-slate-500 group-hover:bg-slate-200/70")}>
          <Icon size={17} strokeWidth={isActive ? 2.5 : 2} />
        </span>
        {item.label}
      </Link>
    );
  };

  return (
    <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-slate-200/80 bg-slate-50/95 px-4 py-5 backdrop-blur-xl md:flex">
      <div className="mb-6 px-1">
        <div className="flex items-center gap-3 rounded-2xl bg-slate-950 px-3 py-3 text-white shadow-floating">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500 text-base font-black shadow-sm">V</div>
          <div className="min-w-0">
            <p className="truncate text-[14px] font-bold">Controle de Vendas</p>
            <p className="mt-0.5 flex items-center gap-1 text-[10px] font-medium text-slate-400"><Sparkles size={11} /> Gestão do negócio</p>
          </div>
        </div>
        <div className="mt-3 rounded-xl border border-slate-200/70 bg-white px-3 py-2.5 shadow-sm">
          <p className="truncate text-xs font-bold text-slate-800">{displayName || ROLE_LABELS[role]}</p>
          <p className="mt-0.5 text-[11px] text-slate-400">{ROLE_LABELS[role]}</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {mainNav.map(renderLink)}
        {secondaryNav.length > 0 && <><div className="my-3 h-px bg-slate-200/70" />{secondaryNav.map(renderLink)}</>}
      </nav>

      <button onClick={handleLogout} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium text-slate-500 transition hover:bg-white hover:text-danger hover:shadow-sm">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100"><LogOut size={17} /></span>
        Sair
      </button>
    </aside>
  );
}
