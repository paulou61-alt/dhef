export type CollaboratorRole = "vendedor" | "cobrador";
export type ViewPermission = "inicio" | "vender" | "clientes" | "fichas" | "cobrancas";

export const VIEW_PERMISSION_LABELS: Record<ViewPermission, { label: string; description: string }> = {
  inicio: { label: "Início", description: "Resumo e indicadores principais" },
  vender: { label: "Vender", description: "Tela para registrar e consultar vendas" },
  clientes: { label: "Clientes", description: "Lista e dados dos clientes" },
  fichas: { label: "Fichas", description: "Histórico completo das fichas dos clientes" },
  cobrancas: { label: "Cobranças", description: "Parcelas pendentes e rotina de cobrança" },
};

export const ALL_VIEW_PERMISSIONS = Object.keys(VIEW_PERMISSION_LABELS) as ViewPermission[];

const ROLE_PERMISSIONS: Record<CollaboratorRole, ViewPermission[]> = {
  vendedor: ["inicio", "vender", "clientes", "fichas"],
  cobrador: ["cobrancas", "clientes", "fichas"],
};

export function getAllowedViewPermissions(role: CollaboratorRole): ViewPermission[] {
  return ROLE_PERMISSIONS[role];
}

export function getDefaultViewPermissions(role: CollaboratorRole): ViewPermission[] {
  return [...ROLE_PERMISSIONS[role]];
}

export function normalizeViewPermissions(role: CollaboratorRole, values: string[] | null | undefined): ViewPermission[] {
  const allowed = new Set(getAllowedViewPermissions(role));
  return Array.from(new Set(values ?? [])).filter((value): value is ViewPermission => allowed.has(value as ViewPermission));
}

export function permissionForPath(pathname: string): ViewPermission | null {
  if (pathname === "/") return "inicio";
  if (pathname.startsWith("/vender")) return "vender";
  if (pathname.startsWith("/clientes")) return "clientes";
  if (pathname.startsWith("/fichas")) return "fichas";
  if (pathname.startsWith("/cobrancas")) return "cobrancas";
  return null;
}

export function firstAllowedPath(role: CollaboratorRole, permissions: ViewPermission[]): string {
  const normalized = normalizeViewPermissions(role, permissions);
  const preference = role === "cobrador"
    ? (["cobrancas", "clientes", "fichas"] as ViewPermission[])
    : (["inicio", "vender", "clientes", "fichas"] as ViewPermission[]);

  const first = preference.find((permission) => normalized.includes(permission));
  if (first === "inicio") return "/";
  if (first === "vender") return "/vender";
  if (first === "clientes") return "/clientes";
  if (first === "fichas") return "/fichas";
  if (first === "cobrancas") return "/cobrancas";
  return "/login";
}
