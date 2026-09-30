import "server-only";

import { getAccessContext } from "@/lib/access";
import { getSubscription, planFeatures } from "@/lib/billing/subscription";
import { UpgradeNotice } from "@/components/billing/UpgradeNotice";
import type { Feature } from "@/lib/billing/plans";

/** Devolve o aviso de upgrade quando o plano não inclui o recurso; senão, null. Uso: `const gate = await featureGate("x"); if (gate) return gate;` */
export async function featureGate(feature: Feature) {
  const access = await getAccessContext();
  if (!access) return null;
  const features = planFeatures(await getSubscription(access));
  return features.has(feature) ? null : <UpgradeNotice feature={feature} isOwner={access.role === "owner"} />;
}
