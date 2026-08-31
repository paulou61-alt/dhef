"use client";

import { Trash2 } from "lucide-react";
import { useTransition } from "react";

export function DeleteVariantButton({
  action,
  confirmMessage,
}: {
  action: () => Promise<{ error?: string }>;
  confirmMessage: string;
}) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!window.confirm(confirmMessage)) return;
    startTransition(async () => {
      const result = await action();
      if (result?.error) window.alert(result.error);
    });
  }

  return (
    <button type="button" onClick={handleClick} disabled={isPending} className="text-slate-400">
      <Trash2 size={15} />
    </button>
  );
}
