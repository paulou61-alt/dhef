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
  HandCoins,
  type LucideIcon,
} from "lucide-react";
import type { AppRole } from "@/lib/access";
import type { ViewPermission } from "@/lib/permissions";
import type { Feature } from "@/lib/billing/plans";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  permission?: ViewPermission;
  /** Recurso de plano necessário para usar a tela (aparece com cadeado quando não incluso). */
  feature?: Feature;
}

export interface NavSection {
  id: string;
  label: string;
  items: NavItem[];
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
  { href: "/financeiro", label: "Financeiro", icon: Wallet, feature: "financeiro" },
  { href: "/relatorios", label: "Relatórios", icon: LineChart, feature: "relatorios" },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

const SELLER_MAIN: NavItem[] = [
  { href: "/", label: "Início", icon: Home, permission: "inicio" },
  { href: "/vender", label: "Vender", icon: ShoppingCart, permission: "vender" },
  { href: "/clientes", label: "Clientes", icon: Users, permission: "clientes" },
  { href: "/fichas", label: "Fichas", icon: ClipboardList, permission: "fichas" },
  { href: "/meu-vale", label: "Meu Vale", icon: HandCoins, feature: "vales" },
];

const COLLECTOR_MAIN: NavItem[] = [
  { href: "/cobrancas", label: "Cobranças", icon: BadgeDollarSign, permission: "cobrancas" },
  { href: "/clientes", label: "Clientes", icon: Users, permission: "clientes" },
  { href: "/fichas", label: "Fichas", icon: ClipboardList, permission: "fichas" },
  { href: "/meu-vale", label: "Meu Vale", icon: HandCoins, feature: "vales" },
];

export const MAIN_NAV = OWNER_MAIN;
export const SECONDARY_NAV = OWNER_SECONDARY;
export const ALL_NAV: NavItem[] = [...OWNER_MAIN, ...OWNER_SECONDARY];

export function getMainNav(role: AppRole, permissions: ViewPermission[] = []): NavItem[] {
  if (role === "vendedor") return SELLER_MAIN.filter((item) => !item.permission || permissions.includes(item.permission));
  if (role === "cobrador") return COLLECTOR_MAIN.filter((item) => !item.permission || permissions.includes(item.permission));
  return OWNER_MAIN;
}

export function getSecondaryNav(role: AppRole): NavItem[] {
  return role === "owner" ? OWNER_SECONDARY : [];
}

// No celular, "Colaborador" ocupa o lugar de "Estoque" na barra inferior,
// e "Estoque" passa para o menu.
const ESTOQUE_ITEM = OWNER_MAIN.find((item) => item.href === "/estoque")!;
const COLABORADORES_ITEM = OWNER_SECONDARY.find((item) => item.href === "/colaboradores")!;

export function getMobileMainNav(role: AppRole, permissions: ViewPermission[] = []): NavItem[] {
  if (role !== "owner") return getMainNav(role, permissions);
  return OWNER_MAIN.map((item) => (item === ESTOQUE_ITEM ? { ...COLABORADORES_ITEM, label: "Colaborador" } : item));
}

export function getMobileSecondaryNav(role: AppRole): NavItem[] {
  if (role !== "owner") return [];
  return OWNER_SECONDARY.map((item) => (item === COLABORADORES_ITEM ? ESTOQUE_ITEM : item));
}

const byHref = (href: string) => [...OWNER_MAIN, ...OWNER_SECONDARY].find((item) => item.href === href)!;

/** Menu lateral do computador, agrupado por assunto. */
export function getSidebarSections(role: AppRole, permissions: ViewPermission[] = []): NavSection[] {
  if (role !== "owner") return [{ id: "menu", label: "Menu", items: getMainNav(role, permissions) }];
  return [
    { id: "operacao", label: "Operação", items: ["/", "/vender", "/clientes", "/fichas", "/receber", "/cobrancas"].map(byHref) },
    { id: "gestao", label: "Gestão", items: ["/estoque", "/colaboradores", "/despesas", "/financeiro", "/relatorios"].map(byHref) },
    { id: "conta", label: "Conta", items: ["/configuracoes"].map(byHref) },
  ];
}
