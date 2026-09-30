"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { clearOfflineStorage, listOfflineOperations } from "@/lib/offline/db";

/** Sai da conta apagando a cópia offline, mas só se não houver alterações pendentes de envio. */
export function useLogout() {
  const router = useRouter();

  return async function logout() {
    const operations = await listOfflineOperations().catch(() => []);
    if (operations.length > 0) {
      window.alert(
        `Existem ${operations.length} alteração${operations.length === 1 ? "" : "ões"} ainda não sincronizada${operations.length === 1 ? "" : "s"}. Conecte-se à internet e aguarde a sincronização antes de sair da conta para não perder esses dados.`
      );
      return;
    }

    await clearOfflineStorage().catch(() => undefined);
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  };
}
