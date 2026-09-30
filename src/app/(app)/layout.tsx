import Link from "next/link";
import { redirect } from "next/navigation";
import { getSubscription, hasAccess, pixDaysLeft, planFeatures, planSummary, trialDaysLeft } from "@/lib/billing/subscription";
import { ALL_FEATURES } from "@/lib/billing/plans";
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
  // Plano pago no Pix perto de vencer: lembra o dono de renovar.
  const pixDays = access.role === "owner" ? pixDaysLeft(subscription) : null;
  const pixExpiring = pixDays !== null && pixDays <= 5;
  const features = planFeatures(subscription);
  const lockedFeatures = ALL_FEATURES.filter((feature) => !features.has(feature));
  const plan = access.role === "owner" ? planSummary(subscription) : null;

  return (
    <div className="min-h-dvh bg-[radial-gradient(circle_at_top_right,_rgba(47,91,246,0.07),_transparent_28%),linear-gradient(to_bottom,_#f8fafc,_#f5f7fb)]">
      <Sidebar role={access.role} displayName={access.name} viewPermissions={access.viewPermissions} lockedFeatures={lockedFeatures} plan={plan} />
      <OfflineStatus userId={access.userId} />
      <div className="md:pl-64">
        <Header role={access.role} lockedFeatures={lockedFeatures} />
        {daysLeft !== null && (
          <Link
            href="/planos"
            className="flex items-center justify-center gap-2 bg-brand-500 px-4 py-2 text-center text-xs font-semibold text-white"
          >
            Teste grátis: {daysLeft === 1 ? "falta 1 dia" : `faltam ${daysLeft} dias`} · <span className="underline">Assinar agora</span>
          </Link>
        )}
        {pixExpiring && (
          <Link
            href="/planos"
            className="flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-center text-xs font-semibold text-white"
          >
            Seu plano vence {pixDays === 0 ? "hoje" : pixDays === 1 ? "amanhã" : `em ${pixDays} dias`} · <span className="underline">Renovar com Pix</span>
          </Link>
        )}
        <main className="mx-auto max-w-6xl px-4 pb-24 pt-4 md:px-8 md:pb-10 md:pt-7">{children}</main>
      </div>
      <BottomNav role={access.role} viewPermissions={access.viewPermissions} />
    </div>
  );
}
