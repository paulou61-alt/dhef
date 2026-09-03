"use client";

import { useEffect, useState, useTransition } from "react";
import { CalendarDays, Check, PencilLine, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { updateInstallmentDueDate } from "@/app/(app)/clientes/actions";
import { formatDate } from "@/utils/format";

export function InstallmentDueDateEditor({
  customerId,
  installmentId,
  dueDate,
}: {
  customerId: string;
  installmentId: string;
  dueDate: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(dueDate);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!editing) setValue(dueDate);
  }, [dueDate, editing]);

  function save() {
    if (!value) return setError("Informe a nova data.");
    setError(null);
    startTransition(async () => {
      const result = await updateInstallmentDueDate({ customerId, installmentId, dueDate: value });
      if (result.error) return setError(result.error);
      setEditing(false);
      router.refresh();
    });
  }

  if (!editing) {
    return (
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1 text-[12px] text-slate-500">
          <CalendarDays size={12} />
          Vence em {formatDate(dueDate)}
        </span>
        <button
          type="button"
          onClick={() => { setEditing(true); setError(null); }}
          className="inline-flex items-center gap-1 rounded-lg bg-brand-50 px-2 py-1 text-[11px] font-semibold text-brand-600"
        >
          <PencilLine size={11} />
          Editar data
        </button>
      </div>
    );
  }

  return (
    <div className="mt-2">
      <div className="flex max-w-sm items-center gap-2">
        <input
          type="date"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="input-field !h-9 min-w-0 flex-1 !py-1.5 text-xs"
          autoFocus
        />
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-brand-600 text-white disabled:opacity-50"
          aria-label="Salvar nova data"
        >
          <Check size={15} />
        </button>
        <button
          type="button"
          onClick={() => { setEditing(false); setValue(dueDate); setError(null); }}
          disabled={pending}
          className="flex h-9 w-9 flex-none items-center justify-center rounded-lg border border-slate-200 text-slate-500"
          aria-label="Cancelar"
        >
          <X size={15} />
        </button>
      </div>
      {error && <p className="mt-1 text-[11px] font-medium text-danger">{error}</p>}
    </div>
  );
}
