"use client";

import { useEffect, useId, useRef, useState } from "react";
import { formatCurrency } from "@/utils/format";

const HEIGHT = 250;
const PAD = { left: 44, right: 10, top: 12, bottom: 26 };

function niceStep(max: number): number {
  if (max <= 0) return 1000;
  const raw = max / 3;
  const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
  const steps = [1, 2, 2.5, 5, 10];
  return magnitude * (steps.find((step) => step * magnitude >= raw) ?? 10);
}

function compact(value: number): string {
  if (value === 0) return "0";
  if (value >= 1000) return `${(value / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return value.toLocaleString("pt-BR");
}

/**
 * Faturamento acumulado do mês (azul) contra o mês anterior (cinza).
 * A linha se desenha ao abrir; passar o mouse ou o dedo mostra o valor do dia.
 */
export function RevenueChart({ current, previous, monthDays, monthShort, currentLabel, previousLabel }: {
  /** Acumulado dia a dia até hoje. */
  current: number[];
  /** Acumulado dia a dia do mês anterior inteiro. */
  previous: number[];
  monthDays: number;
  monthShort: string;
  currentLabel: string;
  previousLabel: string;
}) {
  const id = useId().replace(/:/g, "");
  const wrap = useRef<HTMLDivElement>(null);
  // A largura só é conhecida no navegador; até lá a área fica reservada, sem desenho.
  const [measured, setMeasured] = useState<number | null>(null);
  const width = measured ?? 560;
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const node = wrap.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setMeasured(Math.max(280, entry.contentRect.width)));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const n = Math.max(monthDays, 2);
  const innerW = width - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const maxValue = Math.max(1, ...current, ...previous.slice(0, n));
  const step = niceStep(maxValue);
  const max = Math.ceil(maxValue / step) * step;
  const x = (i: number) => PAD.left + (i / (n - 1)) * innerW;
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;
  const line = (values: number[]) => values.slice(0, n).map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const last = current.length - 1;
  const ticks: number[] = [];
  for (let t = 0; t <= max; t += step) ticks.push(t);
  const dayTicks = [1, 8, 15, 22, n];

  function pick(clientX: number) {
    const rect = wrap.current?.getBoundingClientRect();
    if (!rect || last < 0) return;
    const index = Math.round(((clientX - rect.left - PAD.left) / innerW) * (n - 1));
    setHover(Math.max(0, Math.min(last, index)));
  }

  const h = hover;
  const prevAtHover = h !== null ? previous[Math.min(h, previous.length - 1)] ?? 0 : 0;
  const diff = h !== null && prevAtHover > 0 ? ((current[h] - prevAtHover) / prevAtHover) * 100 : null;
  const tipLeft = h !== null ? (x(h) + 200 > width ? x(h) - 190 : x(h) + 14) : 0;

  return (
    <figure className="relative w-full min-w-0 overflow-hidden" ref={wrap} style={{ height: HEIGHT }}>
      {measured !== null && (
      <svg
        width="100%"
        height={HEIGHT}
        viewBox={`0 0 ${width} ${HEIGHT}`}
        className="block touch-pan-y"
        role="img"
        aria-label={`${currentLabel} acumulado comparado a ${previousLabel}`}
        onPointerMove={(event) => pick(event.clientX)}
        onPointerDown={(event) => pick(event.clientX)}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={`${id}-area`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#4d7fff" stopOpacity={0.3} />
            <stop offset="1" stopColor="#4d7fff" stopOpacity={0} />
          </linearGradient>
          <linearGradient id={`${id}-line`} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="var(--chart-line-from)" />
            <stop offset="1" stopColor="var(--chart-line-to)" />
          </linearGradient>
          <filter id={`${id}-glow`} x="-10%" y="-30%" width="120%" height="160%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--chart-grid)" shapeRendering="crispEdges" />
            <text x={PAD.left - 10} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--chart-axis)">{compact(t)}</text>
          </g>
        ))}
        {dayTicks.map((d, i) => (
          <text key={d} x={x(d - 1)} y={HEIGHT - 6} textAnchor={i === 0 ? "start" : i === dayTicks.length - 1 ? "end" : "middle"} fontSize={11} fill="var(--chart-axis)">
            {String(d).padStart(2, "0")} {monthShort}
          </text>
        ))}

        <path d={line(previous)} fill="none" stroke="var(--chart-prev)" strokeWidth={1.75} strokeLinejoin="round" />
        {last >= 0 && (
          <>
            <path d={`${line(current)}L${x(last)},${y(0)}L${x(0)},${y(0)}Z`} fill={`url(#${id}-area)`} className="animate-rise" style={{ animationDelay: "900ms" }} />
            <path d={line(current)} pathLength={1} fill="none" stroke={`url(#${id}-line)`} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" filter={`url(#${id}-glow)`} className="animate-draw" style={{ animationDuration: "2.2s", animationDelay: "300ms" }} />
            <circle cx={x(last)} cy={y(current[last])} r={5} fill="#4d7fff" opacity={0.4}>
              <animate attributeName="r" values="5;15;5" dur="2.4s" repeatCount="indefinite" />
              <animate attributeName="opacity" values=".45;0;.45" dur="2.4s" repeatCount="indefinite" />
            </circle>
            <circle cx={x(last)} cy={y(current[last])} r={5} fill="#fff" stroke="#2f5bf6" strokeWidth={3} />
          </>
        )}

        {h !== null && (
          <>
            <line x1={x(h)} x2={x(h)} y1={PAD.top} y2={PAD.top + innerH} stroke="var(--chart-axis)" strokeOpacity={0.5} />
            <circle cx={x(h)} cy={y(current[h])} r={5} fill="#fff" stroke="#4d7fff" strokeWidth={3} />
          </>
        )}
      </svg>
      )}

      {h !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 rounded-xl border border-slate-200/80 bg-white/85 px-3 py-2.5 shadow-xl backdrop-blur-xl dark:border-white/15 dark:!bg-slate-900/75"
          style={{ transform: `translate(${tipLeft}px, ${Math.max(0, y(current[h]) - 80)}px)` }}
        >
          <p className="text-[11px] text-slate-500">{String(h + 1).padStart(2, "0")} de {currentLabel.toLowerCase()}</p>
          <p className="mt-1 whitespace-nowrap text-[15px] font-semibold text-slate-900">{formatCurrency(current[h])}</p>
          <p className="whitespace-nowrap text-[12px] text-slate-500">{previousLabel.toLowerCase()}: {formatCurrency(prevAtHover)}</p>
          {diff !== null && (
            <p className={`mt-1 text-[12px] font-medium ${diff >= 0 ? "text-emerald-600 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300"}`}>
              {diff >= 0 ? "▲" : "▼"} {Math.abs(diff).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
            </p>
          )}
        </div>
      )}
    </figure>
  );
}
