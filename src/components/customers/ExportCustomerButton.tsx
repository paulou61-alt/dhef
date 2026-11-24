import { FileDown } from "lucide-react";

export function ExportCustomerButton({ customerId }: { customerId: string }) {
  return (
    <form method="post" action={`/fichas/${customerId}/exportar`} className="mt-4">
      <button type="submit" className="btn-secondary inline-flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm sm:w-auto">
        <FileDown size={17} aria-hidden="true" />
        Exportar cliente
      </button>
    </form>
  );
}
