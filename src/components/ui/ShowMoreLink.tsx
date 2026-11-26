import Link from "next/link";
import { ChevronDown } from "lucide-react";

/** Link "Mostrar mais" de listas longas. Mantém a posição na página ao carregar. */
export function ShowMoreLink({ href, remaining, shown, total }: { href: string; remaining: number; shown: number; total: number }) {
  if (remaining <= 0) return null;
  return (
    <div className="flex flex-col items-center gap-2 py-2">
      <p className="text-xs text-slate-500">Mostrando {shown} de {total}</p>
      <Link href={href} scroll={false} className="btn-secondary !py-2.5 text-sm">
        <ChevronDown size={16} /> Mostrar mais {Math.min(remaining, 40)}
      </Link>
    </div>
  );
}
