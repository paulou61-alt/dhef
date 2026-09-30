// Marca do Cobrei: um "C" que se completa com o sinal de pago.
export function BrandMark({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" className={`flex-none ${className}`} role="img" aria-label="Cobrei">
      <defs>
        <linearGradient id="cobrei-mark-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3d6bff" />
          <stop offset="1" stopColor="#1d3fc9" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="116" fill="url(#cobrei-mark-bg)" />
      <path d="M 304 144 A 136 136 0 1 0 323 366" fill="none" stroke="#fff" strokeWidth="62" strokeLinecap="round" />
      <path d="M 188 262 L 238 312 L 382 168" fill="none" stroke="#fff" strokeWidth="58" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
