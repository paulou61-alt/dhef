import { notFound } from "next/navigation";
import { BadgeCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { InviteAcceptForm } from "@/components/collaborators/InviteAcceptForm";

export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: { params: { token: string } }) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_collaborator_invite", { p_token: params.token });
  const invite = Array.isArray(data) ? data[0] : data;
  if (error || !invite) notFound();

  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface-muted px-4 py-10">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-floating">
        <div className="mb-5 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-success/10 text-success"><BadgeCheck size={24} /></span>
          <h1 className="mt-3 text-xl font-bold text-slate-900">Convite para acessar o sistema</h1>
          <p className="mt-1 text-sm text-slate-500">Olá, <strong>{invite.name}</strong>. Você foi cadastrado como <strong>{invite.role === "cobrador" ? "Cobrador" : "Vendedor"}</strong>.</p>
        </div>
        <InviteAcceptForm token={params.token} name={invite.name} email={invite.email} role={invite.role} />
      </div>
    </div>
  );
}
