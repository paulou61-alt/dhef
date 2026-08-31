import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { CustomerForm } from "@/components/customers/CustomerForm";
import { updateCustomer } from "@/app/(app)/clientes/actions";
import { getAccessContext } from "@/lib/access";

export default async function EditarClientePage({ params }: { params: { id: string } }) {
  const access = await getAccessContext();
  if (!access) redirect("/login");
  if (access.role === "cobrador") redirect(`/fichas/${params.id}`);

  const supabase = createClient();
  const [{ data: customer }, { data: collaborators }] = await Promise.all([
    supabase.from("customers").select("*").eq("id", params.id).single(),
    supabase.from("collaborators").select("id, name, role").eq("is_active", true).order("name"),
  ]);

  if (!customer) notFound();
  const boundAction = updateCustomer.bind(null, customer.id);

  return (
    <div className="space-y-4">
      <Link href={`/clientes/${customer.id}`} className="inline-flex items-center gap-1 text-[14px] font-medium text-slate-500">
        <ChevronLeft size={18} /> {customer.name}
      </Link>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Ficha #{customer.ficha_number}</p>
        <h1 className="text-xl font-bold text-slate-900">Editar cliente</h1>
      </div>
      <CustomerForm customer={customer} action={boundAction} collaborators={(collaborators ?? []) as any} accessRole={access.role} />
    </div>
  );
}
