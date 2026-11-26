"use client";

import { Search, X } from "lucide-react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useTransition } from "react";

export function SearchBar({ placeholder }: { placeholder: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get("q") ?? "");
  const [isPending, startTransition] = useTransition();

  function updateQuery(next: string) {
    setValue(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next) {
      params.set("q", next);
    } else {
      params.delete("q");
    }
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <div className="relative">
      <Search size={17} className={`pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 ${isPending ? "animate-pulse text-brand-500" : "text-slate-400"}`} />
      <input
        className="input-field !rounded-2xl !border-slate-200/80 !bg-white/80 pl-11 pr-9 shadow-[0_1px_2px_rgba(15,23,42,.04),0_8px_24px_-14px_rgba(15,23,42,.18)] dark:!border-white/10 dark:!bg-white/[.04]"
        placeholder={placeholder}
        value={value}
        onChange={(e) => updateQuery(e.target.value)}
      />
      {value && (
        <button
          type="button"
          onClick={() => updateQuery("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}
