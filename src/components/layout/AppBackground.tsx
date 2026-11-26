/** Fundo do app: brilhos azuis que se movem devagar atrás dos cartões de vidro. */
export function AppBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="app-blob left-[18%] top-[-220px] h-[620px] w-[620px]" style={{ background: "var(--blob-1)" }} />
      <div className="app-blob right-[-160px] top-[10%] h-[520px] w-[520px]" style={{ background: "var(--blob-2)", animationDuration: "30s" }} />
      <div className="app-blob bottom-[-220px] left-[-120px] h-[460px] w-[460px]" style={{ background: "var(--blob-3)", animationDuration: "34s" }} />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,.07)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,.07)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_at_60%_0%,#000_15%,transparent_65%)] dark:bg-[linear-gradient(rgba(148,163,184,.05)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,.05)_1px,transparent_1px)]" />
    </div>
  );
}
