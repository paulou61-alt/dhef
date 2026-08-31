"use client";

import { Trash2 } from "lucide-react";
import { useTransition } from "react";

export function DeleteButton({
  action,
  confirmMessage,
  label = "Excluir",
}: {
  action: () => Promise<{ error?: string } | void>;
  confirmMessage: string;
  label?: string;
}) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!window.confirm(confirmMessage)) return;
    startTransition(async () => {
      const result = await action();
      if (result?.error) {
        window.alert(result.error);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="flex items-center gap-2 rounded-xl bg-danger/10 px-4 py-3 text-[14px] font-semibold text-danger disabled:opacity-50"
    >
      <Trash2 size={16} />
      {isPending ? "Excluindo..." : label}
    </button>
  );
}
