import { formatCurrency } from "@/utils/format";

export function CustomerStat({ label, value, tone }: { label: string; value: string; tone?: "warning" | "success" }) {
  return (
    <div className="rounded-xl bg-surface-muted px-3 py-2.5">
      <p className="text-[11px] font-medium text-slate-500">{label}</p>
      <p
        className={
          "mt-0.5 text-[15px] font-bold " +
          (tone === "warning" ? "text-warning" : tone === "success" ? "text-success" : "text-slate-900")
        }
      >
        {value}
      </p>
    </div>
  );
}

export { formatCurrency };
