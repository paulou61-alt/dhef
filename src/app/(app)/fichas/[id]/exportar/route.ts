import { getAccessContext } from "@/lib/access";
import { getSubscription, hasAccess } from "@/lib/billing/subscription";
import { createCustomerStatementPdf } from "@/lib/pdf/customer-statement-pdf";
import { loadCustomerStatement } from "@/lib/reports/load-customer-statement";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const headers = { "Cache-Control": "private, no-store" };
  const access = await getAccessContext();
  if (!access) return new Response("Entre novamente para exportar a ficha.", { status: 401, headers });
  if (!access.viewPermissions.includes("fichas") || !hasAccess(await getSubscription(access))) {
    return new Response("Sua conta não tem acesso a esta ficha.", { status: 403, headers });
  }
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(params.id)) {
    return new Response("Ficha não encontrada.", { status: 404, headers });
  }

  try {
    const statement = await loadCustomerStatement(params.id, access);
    if (!statement) return new Response("Ficha não encontrada.", { status: 404, headers });
    const pdf = createCustomerStatementPdf(statement);
    return new Response(pdf, { headers: {
      ...headers,
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="ficha-${Number(statement.customer.ficha_number)}.pdf"`,
    } });
  } catch {
    return new Response("Não foi possível carregar a ficha completa. Volte à ficha e tente exportar novamente.", { status: 500, headers });
  }
}
