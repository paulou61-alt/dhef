/** Mini gráfico de tendência que se desenha ao aparecer. O último ponto fica em destaque. */
export function Sparkline({ values, delay = 0, className = "" }: { values: number[]; delay?: number; className?: string }) {
  if (values.length < 2) return null;
  const width = 120;
  const height = 34;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const x = (i: number) => 2 + (i / (values.length - 1)) * (width - 6);
  const y = (v: number) => 4 + (1 - (v - min) / (max - min || 1)) * (height - 8);
  const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
  const last = values.length - 1;

  return (
    <div className={`relative h-[34px] w-full ${className}`} aria-hidden>
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="block h-full w-full overflow-visible">
      <path d={`M${points.join(" L")} L${x(last)},${height} L${x(0)},${height} Z`} className="fill-brand-500/10 dark:fill-brand-400/15" />
      <path
        d={`M${points.join(" L")}`}
        pathLength={1}
        fill="none"
        strokeWidth={1.75}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        className="animate-draw stroke-brand-400 dark:stroke-brand-300"
        style={{ animationDelay: `${delay}ms` }}
      />
    </svg>
    {/* O ponto fica fora do SVG esticado para continuar redondo. */}
    <span
      className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-brand-500 bg-white"
      style={{ left: `${(x(last) / width) * 100}%`, top: `${(y(values[last]) / height) * 100}%` }}
    />
    </div>
  );
}
