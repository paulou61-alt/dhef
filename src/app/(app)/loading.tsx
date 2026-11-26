// Aparece na hora em que se toca em um item do menu, enquanto o servidor
// prepara a tela. Sem isto, o app parecia travado até a página chegar.
export default function Loading() {
  return (
    <div className="space-y-4" role="status" aria-label="Carregando">
      <div className="h-8 w-48 animate-pulse rounded-xl bg-slate-200/70 dark:bg-white/[.06]" />
      <div className="card h-28 animate-pulse" />
      <div className="card space-y-3">
        <div className="h-4 w-40 animate-pulse rounded-lg bg-slate-200/70 dark:bg-white/[.06]" />
        <div className="h-12 animate-pulse rounded-xl bg-slate-200/60 dark:bg-white/[.05]" />
      </div>
      <div className="card space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-10 w-10 flex-none animate-pulse rounded-full bg-slate-200/70 dark:bg-white/[.06]" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-1/3 animate-pulse rounded bg-slate-200/70 dark:bg-white/[.06]" />
              <div className="h-3 w-1/4 animate-pulse rounded bg-slate-200/50 dark:bg-white/[.04]" />
            </div>
            <div className="h-4 w-20 animate-pulse rounded bg-slate-200/70 dark:bg-white/[.06]" />
          </div>
        ))}
      </div>
      <span className="sr-only">Carregando…</span>
    </div>
  );
}
