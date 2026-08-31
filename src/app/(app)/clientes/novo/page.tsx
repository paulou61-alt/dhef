import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { CustomerForm } from "@/components/customers/CustomerForm";
import { createCustomer } from "@/app/(app)/clientes/actions";
import { createClient } from "@/lib/supabase/server";
import { getAccessContext } from "@/lib/access";

export default async function NovoClientePage() {
  const access = await getAccessContext();
  if (!access) redirect("/login");
  if (access.role === "cobrador") redirect("/cobrancas");

  const supabase = createClient();
  const { data: collaborators } = await supabase
    .from("collaborators")
    .select("id, name, role")
    .eq("is_active", true)
    .order("name");

  return (
    <div className="space-y-4">
      <Link href="/clientes" className="inline-flex items-center gap-1 text-[14px] font-medium text-slate-500">
        <ChevronLeft size={18} /> Clientes
      </Link>
      <h1 className="text-xl font-bold text-slate-900">Novo cliente</h1>
      <CustomerForm action={createCustomer} collaborators={(collaborators ?? []) as any} accessRole={access.role} />
    </div>
  );
}
