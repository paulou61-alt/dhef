import {
  Home,
  ShoppingCart,
  Users,
  Wallet,
  Package,
  Receipt,
  LineChart,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

// Menu principal — aparece no bottom nav (mobile) e no topo da sidebar (desktop)
export const MAIN_NAV: NavItem[] = [
  { href: "/", label: "Início", icon: Home },
  { href: "/vender", label: "Vender", icon: ShoppingCart },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/receber", label: "Receber", icon: Wallet },
  { href: "/estoque", label: "Estoque", icon: Package },
];

// Menu secundário — aparece só na sidebar (desktop) e num menu "mais" (mobile)
export const SECONDARY_NAV: NavItem[] = [
  { href: "/despesas", label: "Despesas", icon: Receipt },
  { href: "/financeiro", label: "Financeiro", icon: Wallet },
  { href: "/relatorios", label: "Relatórios", icon: LineChart },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];
