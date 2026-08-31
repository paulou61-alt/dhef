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
      <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        className="input-field pl-10 pr-9"
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
