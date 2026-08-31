import { createClient } from "@/lib/supabase/server";

export type AppRole = "owner" | "vendedor" | "cobrador";

export interface AccessContext {
  userId: string;
  ownerId: string;
  role: AppRole;
  collaboratorId: string | null;
  name: string | null;
}

export async function getAccessContext(): Promise<AccessContext | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: collaborator } = await supabase
    .from("collaborators")
    .select("id, owner_id, name, role, is_active")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (collaborator) {
    if (!collaborator.is_active) return null;
    return {
      userId: user.id,
      ownerId: collaborator.owner_id,
      role: collaborator.role as AppRole,
      collaboratorId: collaborator.id,
      name: collaborator.name,
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
  };
}
