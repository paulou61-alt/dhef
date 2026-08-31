import { DollarSign, TrendingUp, Wallet, Users, ShoppingBag, PackageX } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/dashboard/StatCard";
import { OverdueList, type OverdueItem } from "@/components/dashboard/OverdueList";
import { SimpleList, type SimpleListItem } from "@/components/dashboard/SimpleList";
import { formatCurrency, formatDate } from "@/utils/format";

// Evita cache — dados financeiros precisam estar sempre atualizados
export const dynamic = "force-dynamic";

function startOfToday() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

function startOfMonth() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}

function daysFromNow(n: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export default async function DashboardPage() {
  const supabase = createClient();
  const today = startOfToday();
  const monthStart = startOfMonth();
  const todayDate = new Date().toISOString().slice(0, 10);
  const in7days = daysFromNow(7);

  const [
    { data: salesToday },
    { data: salesMonth },
    { data: overdueInstallments },
    { data: upcomingInstallments },
    { data: recentSales },
    { data: lowStockVariants },
    { count: customersOwingCount },
  ] = await Promise.all([
    supabase.from("sales").select("total").eq("status", "completed").gte("created_at", today),

    supabase
      .from("sales")
      .select("id, total, is_paid, sale_items(quantity, unit_cost_snapshot, unit_price_snapshot)")
      .eq("status", "completed")
      .gte("created_at", monthStart),

    supabase
      .from("installments")
      .select("id, amount, paid_amount, due_date, sales!inner(customer_id, customers(name, phone, whatsapp))")
      .in("status", ["pendente", "parcial"])
      .lt("due_date", todayDate)
      .order("due_date", { ascending: true })
      .limit(10),

    supabase
      .from("installments")
      .select("id, amount, due_date, sales!inner(customers(name))")
      .in("status", ["pendente", "parcial"])
      .gte("due_date", todayDate)
      .lte("due_date", in7days)
      .order("due_date", { ascending: true })
      .limit(6),

    supabase
      .from("sales")
      .select("id, total, created_at, sale_number, customers(name)")
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(6),

    supabase
      .from("product_variants")
      .select("id, variant_name, stock_quantity, min_stock, products(name)")
      .order("stock_quantity", { ascending: true })
      .limit(50),

    supabase
      .from("installments")
      .select("sales!inner(customer_id)", { count: "exact", head: true })
      .in("status", ["pendente", "parcial", "vencido"]),
  ]);

  // --- cálculos ---
  const revenueToday = (salesToday ?? []).reduce((sum, s) => sum + Number(s.total), 0);

  const revenueMonth = (salesMonth ?? []).reduce((sum, s) => sum + Number(s.total), 0);

  const profitMonth = (salesMonth ?? []).reduce((sum, sale: any) => {
    const items = sale.sale_items ?? [];
    const saleProfit = items.reduce(
      (itemSum: number, item: any) =>
        itemSum +
        (Number(item.unit_price_snapshot) - Number(item.unit_cost_snapshot)) *
          Number(item.quantity),
      0
    );
    return sum + saleProfit;
  }, 0);

  const receivedMonth = (salesMonth ?? [])
    .filter((s: any) => s.is_paid)
    .reduce((sum, s: any) => sum + Number(s.total), 0);

  const totalOpen = (overdueInstallments ?? []).reduce(
    (sum, i: any) => sum + (Number(i.amount) - Number(i.paid_amount)),
    0
  );

  const lowStockItems = (lowStockVariants ?? []).filter(
    (v: any) => v.stock_quantity <= v.min_stock
  );

  const overdueList: OverdueItem[] = (overdueInstallments ?? []).map((i: any) => ({
    installmentId: i.id,
    customerName: i.sales?.customers?.name ?? "Cliente",
    customerPhone: i.sales?.customers?.whatsapp ?? i.sales?.customers?.phone ?? null,
    amount: Number(i.amount) - Number(i.paid_amount),
    dueDate: i.due_date,
  }));

  const upcomingList: SimpleListItem[] = (upcomingInstallments ?? []).map((i: any) => ({
    id: i.id,
    title: i.sales?.customers?.name ?? "Cliente",
    subtitle: `Vence em ${formatDate(i.due_date)}`,
    value: Number(i.amount),
    href: "/receber",
  }));

  const recentSalesList: SimpleListItem[] = (recentSales ?? []).map((s: any) => ({
    id: s.id,
    title: s.customers?.name ?? "Venda avulsa",
    subtitle: `Venda #${s.sale_number} · ${formatDate(s.created_at)}`,
    value: Number(s.total),
    href: `/vender/${s.id}`,
  }));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Vendas hoje" value={formatCurrency(revenueToday)} icon={DollarSign} />
        <StatCard label="Faturamento do mês" value={formatCurrency(revenueMonth)} icon={TrendingUp} tone="success" />
        <StatCard label="Lucro estimado do mês" value={formatCurrency(profitMonth)} icon={Wallet} tone="success" />
        <StatCard label="Recebido no mês" value={formatCurrency(receivedMonth)} icon={ShoppingBag} />
        <StatCard label="A receber" value={formatCurrency(totalOpen)} icon={Wallet} tone="warning" />
        <StatCard
          label="Clientes devendo"
          value={String(customersOwingCount ?? 0)}
          icon={Users}
          tone="warning"
        />
        <StatCard
          label="Vendas realizadas (mês)"
          value={String((salesMonth ?? []).length)}
          icon={ShoppingBag}
        />
        <StatCard
          label="Estoque baixo"
          value={String(lowStockItems.length)}
          icon={PackageX}
          tone={lowStockItems.length > 0 ? "danger" : "default"}
        />
      </div>

      <OverdueList items={overdueList} />

      <div className="grid gap-5 md:grid-cols-2">
        <SimpleList
          title="Próximos recebimentos (7 dias)"
          items={upcomingList}
          emptyMessage="Nenhum recebimento previsto para os próximos dias."
        />
        <SimpleList
          title="Últimas vendas"
          items={recentSalesList}
          emptyMessage="Nenhuma venda registrada ainda."
        />
      </div>
    </div>
  );
}
