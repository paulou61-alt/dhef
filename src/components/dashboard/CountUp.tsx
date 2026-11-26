"use client";

import { useEffect, useRef, useState } from "react";

type CountFormat = "currency" | "currency-int" | "integer" | "percent";

function format(value: number, kind: CountFormat): string {
  switch (kind) {
    case "currency":
      return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    case "currency-int":
      return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
    case "percent":
      return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%`;
    default:
      return Math.round(value).toLocaleString("pt-BR");
  }
}

/**
 * Número que "conta" do zero até o valor ao aparecer na tela.
 * O HTML do servidor já vem com o valor final, então nada some se o JavaScript falhar.
 */
export function CountUp({ value, format: kind = "integer", delay = 0, duration = 1600, className }: {
  value: number;
  format?: CountFormat;
  delay?: number;
  duration?: number;
  className?: string;
}) {
  const [shown, setShown] = useState(value);
  const frame = useRef<number>();

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(value);
      return;
    }
    const start = performance.now() + delay;
    const ease = (t: number) => 1 - Math.pow(1 - t, 4);
    setShown(0);
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / duration));
      setShown(value * ease(t));
      if (t < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => { if (frame.current) cancelAnimationFrame(frame.current); };
  }, [value, delay, duration]);

  return <span className={className} aria-label={format(value, kind)}><span aria-hidden>{format(shown, kind)}</span></span>;
}
