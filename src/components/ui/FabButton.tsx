import Link from "next/link";
import { Plus } from "lucide-react";

export function FabButton({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="fixed bottom-24 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-brand-500 text-white shadow-floating active:scale-95 md:hidden"
      aria-label={label}
    >
      <Plus size={26} />
    </Link>
  );
}
