"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clsx } from "clsx";
import { LogOut } from "lucide-react";
import { MAIN_NAV, SECONDARY_NAV } from "@/lib/nav-items";
import { createClient } from "@/lib/supabase/client";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const renderLink = (item: (typeof MAIN_NAV)[number]) => {
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
      <div className="mb-8 flex items-center gap-2 px-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500 text-base font-bold text-white">V</div>
        <span className="text-[15px] font-bold text-slate-900">Controle de Vendas</span>
      </div>
      <nav className="flex flex-1 flex-col gap-1">
        {MAIN_NAV.map(renderLink)}
        <div className="my-3 h-px bg-slate-100" />
        {SECONDARY_NAV.map(renderLink)}
      </nav>
      <button onClick={handleLogout} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium text-slate-500 transition hover:bg-slate-50"><LogOut size={19} />Sair</button>
    </aside>
  );
}
