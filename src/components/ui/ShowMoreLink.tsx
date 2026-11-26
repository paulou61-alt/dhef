"use client";

import { useEffect, useRef, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/**
 * Fim de uma lista longa: quando a pessoa rola até aqui, os próximos itens
 * carregam sozinhos. O link continua como reserva (sem JavaScript, ou se o
 * navegador não avisar a rolagem).
 */
export function ShowMoreLink({ href, remaining, shown, total }: { href: string; remaining: number; shown: number; total: number }) {
  const router = useRouter();
  const sentinel = useRef<HTMLDivElement>(null);
  const [loading, startTransition] = useTransition();

  useEffect(() => {
    const node = sentinel.current;
    if (!node || remaining <= 0 || loading || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        startTransition(() => router.replace(href, { scroll: false }));
      },
      // Começa a carregar um pouco antes do fim, para a rolagem não parar.
      { rootMargin: "600px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [href, remaining, loading, router]);

  if (remaining <= 0) return null;

  return (
    <div ref={sentinel} className="flex flex-col items-center gap-2 py-3" aria-live="polite">
      {loading ? (
        <p className="flex items-center gap-2 text-xs text-slate-500"><Loader2 size={14} className="animate-spin" /> Carregando mais…</p>
      ) : (
        <>
          <p className="text-xs text-slate-500">Mostrando {shown} de {total}</p>
          <Link href={href} scroll={false} replace className="text-xs font-semibold text-brand-600">Carregar mais</Link>
        </>
      )}
    </div>
  );
}
