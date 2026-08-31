import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { CustomerForm } from "@/components/customers/CustomerForm";
import { updateCustomer } from "@/app/(app)/clientes/actions";

export default async function EditarClientePage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: customer } = await supabase.from("customers").select("*").eq("id", params.id).single();

  if (!customer) notFound();

  const boundAction = updateCustomer.bind(null, customer.id);

  return (
    <div className="space-y-4">
      <Link
        href={`/clientes/${customer.id}`}
        className="inline-flex items-center gap-1 text-[14px] font-medium text-slate-500"
      >
        <ChevronLeft size={18} />
        {customer.name}
      </Link>
      <h1 className="text-xl font-bold text-slate-900">Editar cliente</h1>
      <CustomerForm customer={customer} action={boundAction} />
    </div>
  );
}
