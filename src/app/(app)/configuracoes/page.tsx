import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "@/components/settings/ProfileForm";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("*").eq("id", user.id).single()
    : { data: null as any };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Configurações</h1>
        <p className="mt-1 text-sm text-slate-500">Dados usados para identificar seu negócio dentro do sistema.</p>
      </div>
      <ProfileForm profile={profile} email={user?.email ?? ""} />
    </div>
  );
}
