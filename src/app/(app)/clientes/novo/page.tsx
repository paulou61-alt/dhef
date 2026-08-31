import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { CustomerForm } from "@/components/customers/CustomerForm";
import { createCustomer } from "@/app/(app)/clientes/actions";

export default function NovoClientePage() {
  return (
    <div className="space-y-4">
      <Link href="/clientes" className="inline-flex items-center gap-1 text-[14px] font-medium text-slate-500">
        <ChevronLeft size={18} />
        Clientes
      </Link>
      <h1 className="text-xl font-bold text-slate-900">Novo cliente</h1>
      <CustomerForm action={createCustomer} />
    </div>
  );
}
