import { createClient } from "@/lib/supabase/server";
import { ALL_VIEW_PERMISSIONS, normalizeViewPermissions, type ViewPermission } from "@/lib/permissions";

export type AppRole = "owner" | "vendedor" | "cobrador";

export interface AccessContext {
  userId: string;
  ownerId: string;
  role: AppRole;
  collaboratorId: string | null;
  name: string | null;
  viewPermissions: ViewPermission[];
}

export async function getAccessContext(): Promise<AccessContext | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: collaborator } = await supabase
    .from("collaborators")
    .select("id, owner_id, name, role, is_active, view_permissions")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (collaborator) {
    if (!collaborator.is_active) return null;
    const role = collaborator.role as "vendedor" | "cobrador";
    return {
      userId: user.id,
      ownerId: collaborator.owner_id,
      role,
      collaboratorId: collaborator.id,
      name: collaborator.name,
      viewPermissions: normalizeViewPermissions(role, collaborator.view_permissions as string[] | null),
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  return {
    userId: user.id,
    ownerId: user.id,
    role: "owner",
    collaboratorId: null,
    name: profile?.full_name ?? user.email ?? null,
    viewPermissions: ALL_VIEW_PERMISSIONS,
  };
}
