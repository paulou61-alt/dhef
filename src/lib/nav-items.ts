import {
  Home,
  ShoppingCart,
  Users,
  Wallet,
  Package,
  Receipt,
  LineChart,
  Settings,
  ClipboardList,
  UserRoundCog,
  BadgeDollarSign,
  type LucideIcon,
} from "lucide-react";
import type { AppRole } from "@/lib/access";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const OWNER_MAIN: NavItem[] = [
  { href: "/", label: "Início", icon: Home },
  { href: "/vender", label: "Vender", icon: ShoppingCart },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/fichas", label: "Fichas", icon: ClipboardList },
  { href: "/receber", label: "Receber", icon: Wallet },
  { href: "/estoque", label: "Estoque", icon: Package },
];

const OWNER_SECONDARY: NavItem[] = [
  { href: "/cobrancas", label: "Cobranças", icon: BadgeDollarSign },
  { href: "/colaboradores", label: "Colaboradores", icon: UserRoundCog },
  { href: "/despesas", label: "Despesas", icon: Receipt },
  { href: "/financeiro", label: "Financeiro", icon: Wallet },
  { href: "/relatorios", label: "Relatórios", icon: LineChart },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

const SELLER_MAIN: NavItem[] = [
  { href: "/", label: "Início", icon: Home },
  { href: "/vender", label: "Vender", icon: ShoppingCart },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/fichas", label: "Fichas", icon: ClipboardList },
  { href: "/estoque", label: "Estoque", icon: Package },
];

const COLLECTOR_MAIN: NavItem[] = [
  { href: "/cobrancas", label: "Cobranças", icon: BadgeDollarSign },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/fichas", label: "Fichas", icon: ClipboardList },
];

export const MAIN_NAV = OWNER_MAIN;
export const SECONDARY_NAV = OWNER_SECONDARY;
export const ALL_NAV: NavItem[] = [...OWNER_MAIN, ...OWNER_SECONDARY];

export function getMainNav(role: AppRole): NavItem[] {
  if (role === "vendedor") return SELLER_MAIN;
  if (role === "cobrador") return COLLECTOR_MAIN;
  return OWNER_MAIN;
}

export function getSecondaryNav(role: AppRole): NavItem[] {
  return role === "owner" ? OWNER_SECONDARY : [];
}
