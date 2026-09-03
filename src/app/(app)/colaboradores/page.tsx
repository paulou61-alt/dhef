import { redirect } from "next/navigation";
import { UserRoundCog } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getAccessContext } from "@/lib/access";
import { CollaboratorForm } from "@/components/collaborators/CollaboratorForm";
import { CollaboratorProfileCard } from "@/components/collaborators/CollaboratorProfileCard";
import { CollaboratorAccessButton } from "@/components/collaborators/CollaboratorAccessButton";
import { normalizeViewPermissions } from "@/lib/permissions";

export const dynamic = "force-dynamic";

type ValeMovement = {
  id: string;
  collaborator_id: string;
  movement_type: "vale" | "abatimento";
  amount: number;
  movement_date: string;
  notes: string | null;
  created_at: string;
};

export default async function ColaboradoresPage() {
  const access = await getAccessContext();
  if (!access) redirect("/login");
  if (access.role !== "owner") redirect("/login");

  const supabase = createClient();
  const [collaboratorsResult, customersResult, salesResult, paymentsResult, valesResult] = await Promise.all([
    supabase
      .from("collaborators")
      .select("id, name, phone, role, is_active, auth_user_id, accepted_at, view_permissions")
      .eq("owner_id", access.ownerId)
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("customers")
      .select("id, assigned_collaborator_id")
      .eq("user_id", access.ownerId),
    supabase
      .from("sales")
      .select("created_by_collaborator_id, customer_id, total, status")
      .eq("user_id", access.ownerId),
    supabase
      .from("payments")
      .select("collected_by_collaborator_id, amount")
      .eq("user_id", access.ownerId),
    supabase
      .from("collaborator_vale_movements")
      .select("id, collaborator_id, movement_type, amount, movement_date, notes, created_at")
      .eq("owner_id", access.ownerId)
      .order("movement_date", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  const collaborators = collaboratorsResult.data ?? [];
  const customers = customersResult.data ?? [];
  const sales = salesResult.data ?? [];
  const payments = paymentsResult.data ?? [];
  const valeMovements = (valesResult.data ?? []) as ValeMovement[];

  const customerCollaborators = new Map<string, string>();
  for (const customer of customers) {
    if (customer.assigned_collaborator_id) {
      customerCollaborators.set(customer.id, customer.assigned_collaborator_id);
    }
  }

  const salesTotals = new Map<string, { total: number; count: number }>();
  for (const sale of sales) {
    if (sale.status === "cancelled") continue;

    // Se a venda foi feita diretamente por um colaborador, ele é o responsável.
    // Quando o proprietário lança a venda, usamos o colaborador responsável pela ficha do cliente.
    const collaboratorId = sale.created_by_collaborator_id
      ?? (sale.customer_id ? customerCollaborators.get(sale.customer_id) : null);

    if (!collaboratorId) continue;

    const current = salesTotals.get(collaboratorId) ?? { total: 0, count: 0 };
    current.total += Number(sale.total ?? 0);
    current.count += 1;
    salesTotals.set(collaboratorId, current);
  }

  const collectionTotals = new Map<string, number>();
  for (const payment of payments) {
    if (!payment.collected_by_collaborator_id) continue;
    collectionTotals.set(payment.collected_by_collaborator_id, (collectionTotals.get(payment.collected_by_collaborator_id) ?? 0) + Number(payment.amount ?? 0));
  }

  const valesByCollaborator = new Map<string, ValeMovement[]>();
  const valeBalances = new Map<string, number>();
  for (const movement of valeMovements) {
    const list = valesByCollaborator.get(movement.collaborator_id) ?? [];
    list.push(movement);
    valesByCollaborator.set(movement.collaborator_id, list);
    const signedAmount = movement.movement_type === "vale" ? Number(movement.amount ?? 0) : -Number(movement.amount ?? 0);
    valeBalances.set(movement.collaborator_id, (valeBalances.get(movement.collaborator_id) ?? 0) + signedAmount);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Colaboradores</h1>
        <p className="mt-1 text-sm text-slate-500">Gerencie a equipe, as visualizações, vendas e vales de cada colaborador.</p>
      </div>

      <CollaboratorForm />

      <div className="card !p-0">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-bold text-slate-900">Equipe cadastrada</h2>
          <p className="mt-0.5 text-xs text-slate-500">Clique em um colaborador para abrir o perfil financeiro e alterar o que ele pode ver.</p>
        </div>

        {collaborators.length === 0 ? (
          <div className="py-10 text-center">
            <UserRoundCog className="mx-auto mb-2 text-slate-300" size={30} />
            <p className="text-sm text-slate-500">Nenhum colaborador cadastrado.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {collaborators.map((collaborator) => {
              const role = collaborator.role as "vendedor" | "cobrador";
              const salesMetric = salesTotals.get(collaborator.id) ?? { total: 0, count: 0 };
              const hasAccess = Boolean(collaborator.auth_user_id && collaborator.accepted_at && collaborator.is_active);

              return (
                <div key={collaborator.id}>
                  <CollaboratorProfileCard
                    collaborator={{ id: collaborator.id, name: collaborator.name, phone: collaborator.phone, role }}
                    hasAccess={hasAccess}
                    viewPermissions={normalizeViewPermissions(role, collaborator.view_permissions as string[] | null)}
                    salesTotal={salesMetric.total}
                    salesCount={salesMetric.count}
                    collectionsTotal={collectionTotals.get(collaborator.id) ?? 0}
                    valeBalance={Math.max(0, valeBalances.get(collaborator.id) ?? 0)}
                    valeMovements={valesByCollaborator.get(collaborator.id) ?? []}
                  />

                  {!hasAccess && (
                    <div className="flex justify-end px-4 pb-3">
                      <CollaboratorAccessButton
                        collaboratorId={collaborator.id}
                        collaboratorName={collaborator.name}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
