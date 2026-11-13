import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/billing/stripe";
import { actionFor, paidUntil, planFrom, validSignature, type KiwifyPayload } from "@/lib/billing/kiwify";

export const dynamic = "force-dynamic";

type Admin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Acha a empresa (dono) que comprou: pelo código que o Cobrei manda no link (sck) ou pelo e-mail da compra. */
async function findOwnerId(admin: Admin, payload: KiwifyPayload): Promise<string | null> {
  const sck = payload.TrackingParameters?.sck?.trim();
  if (sck && UUID.test(sck)) {
    const { data } = await admin.auth.admin.getUserById(sck);
    if (data?.user) return ownerOf(admin, data.user.id);
  }

  const email = payload.Customer?.email?.trim().toLowerCase();
  if (!email) return null;
  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data) return null;
    const user = data.users.find((item) => item.email?.toLowerCase() === email);
    if (user) return ownerOf(admin, user.id);
    if (data.users.length < 1000) return null;
  }
  return null;
}

// Se o e-mail for de um colaborador, o plano vale para a empresa dele.
async function ownerOf(admin: Admin, userId: string) {
  const { data } = await admin.from("collaborators").select("owner_id").eq("auth_user_id", userId).maybeSingle();
  return (data?.owner_id as string | undefined) ?? userId;
}

export async function POST(request: Request) {
  const token = process.env.KIWIFY_WEBHOOK_TOKEN;
  const admin = getSupabaseAdmin();
  if (!token || !admin) {
    return NextResponse.json({ error: "Webhook da Kiwify não configurado." }, { status: 503 });
  }

  const rawBody = await request.text();
  const signature = new URL(request.url).searchParams.get("signature");
  if (!validSignature(rawBody, signature, token)) {
    return NextResponse.json({ error: "Assinatura inválida." }, { status: 401 });
  }

  let payload: KiwifyPayload;
  try {
    payload = JSON.parse(rawBody) as KiwifyPayload;
  } catch {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }

  const action = actionFor(payload);
  if (action === "ignorar") return NextResponse.json({ ok: true, action });

  const ownerId = await findOwnerId(admin, payload);
  if (!ownerId) {
    // Fica registrado no log da Vercel para liberar à mão.
    console.warn("[kiwify] compra sem conta no Cobrei", { order: payload.order_id, email: payload.Customer?.email, action });
    return NextResponse.json({ ok: false, action, reason: "conta não encontrada" });
  }

  const { data: current } = await admin
    .from("subscriptions")
    .select("plan, billing_interval, current_period_end")
    .eq("owner_id", ownerId)
    .maybeSingle();

  let update: Record<string, unknown>;
  if (action === "liberar") {
    const found = planFrom(payload);
    const interval = found.interval ?? (current?.billing_interval as "mensal" | "anual" | null) ?? null;
    update = {
      status: "kiwify",
      plan: found.plan ?? current?.plan ?? null,
      billing_interval: interval,
      current_period_end: paidUntil(payload, interval),
      cancel_at_period_end: false,
    };
  } else if (action === "cancelar") {
    // Cancelou a assinatura: usa até o fim do período já pago.
    update = { status: "kiwify", cancel_at_period_end: true };
  } else {
    // Reembolso ou estorno: corta o acesso agora.
    update = { status: "kiwify", current_period_end: new Date().toISOString(), cancel_at_period_end: true };
  }

  const { error } = await admin.from("subscriptions").upsert({ owner_id: ownerId, ...update }, { onConflict: "owner_id" });
  if (error) {
    console.error("[kiwify] erro ao salvar", { order: payload.order_id, message: error.message });
    return NextResponse.json({ error: "Erro ao salvar." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, action });
}
