import Link from "next/link";
import { redirect } from "next/navigation";
import { getSubscription, hasAccess, trialDaysLeft } from "@/lib/billing/subscription";
import { Sidebar } from "@/components/layout/Sidebar";
import { BottomNav } from "@/components/layout/BottomNav";
import { Header } from "@/components/layout/Header";
import { OfflineStatus } from "@/components/offline/OfflineStatus";
import { getAccessContext } from "@/lib/access";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const access = await getAccessContext();
  if (!access) redirect("/login");

  // Teste encerrado ou assinatura inativa: a empresa só acessa a tela de planos.
  const subscription = await getSubscription(access);
  if (!hasAccess(subscription)) redirect("/planos");
  const daysLeft = access.role === "owner" ? trialDaysLeft(subscription) : null;

  return (
    <div className="min-h-dvh bg-[radial-gradient(circle_at_top_right,_rgba(47,91,246,0.07),_transparent_28%),linear-gradient(to_bottom,_#f8fafc,_#f5f7fb)]">
      <Sidebar role={access.role} displayName={access.name} viewPermissions={access.viewPermissions} />
      <OfflineStatus userId={access.userId} />
      <div className="md:pl-64">
        <Header role={access.role} />
        {daysLeft !== null && (
          <Link
            href="/planos"
            className="flex items-center justify-center gap-2 bg-brand-500 px-4 py-2 text-center text-xs font-semibold text-white"
          >
            Teste grátis: {daysLeft === 1 ? "falta 1 dia" : `faltam ${daysLeft} dias`} · <span className="underline">Assinar agora</span>
          </Link>
        )}
        <main className="mx-auto max-w-6xl px-4 pb-24 pt-4 md:px-8 md:pb-10 md:pt-7">{children}</main>
      </div>
      <BottomNav role={access.role} viewPermissions={access.viewPermissions} />
    </div>
  );
}
