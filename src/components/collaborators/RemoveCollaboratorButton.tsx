"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { removeCollaborator } from "@/app/(app)/colaboradores/actions";

export function RemoveCollaboratorButton({
  collaboratorId,
  collaboratorName,
}: {
  collaboratorId: string;
  collaboratorName: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleRemove() {
    const confirmed = window.confirm(
      `Remover ${collaboratorName}?\n\nO acesso será encerrado e os clientes vinculados ficarão sem colaborador. O histórico antigo de vendas e recebimentos será preservado.`
    );

    if (!confirmed) return;
    setError(null);

    startTransition(async () => {
      const result = await removeCollaborator(collaboratorId);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleRemove}
        disabled={isPending}
        className="inline-flex items-center gap-1.5 rounded-lg border border-danger/20 bg-danger/5 px-2.5 py-1.5 text-xs font-semibold text-danger transition hover:border-danger/30 hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Trash2 size={14} />
        {isPending ? "Removendo..." : "Remover colaborador"}
      </button>
      {error && <p className="max-w-52 text-right text-[11px] font-medium text-danger">{error}</p>}
    </div>
  );
}
