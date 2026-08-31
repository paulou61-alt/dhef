import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Não autorizado." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "Configuração do servidor indisponível." }, 500);

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  const owner = authData.user;
  if (authError || !owner) return json({ error: "Sessão inválida." }, 401);

  const { data: callerCollaborator } = await admin.from("collaborators").select("id").eq("auth_user_id", owner.id).maybeSingle();
  if (callerCollaborator) return json({ error: "Apenas o proprietário pode cadastrar colaboradores." }, 403);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Dados inválidos." }, 400); }

  const name = String(body?.name ?? "").trim();
  const username = String(body?.username ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  const phone = String(body?.phone ?? "").trim() || null;
  const role = body?.role === "cobrador" ? "cobrador" : body?.role === "vendedor" ? "vendedor" : null;

  if (!name) return json({ error: "Informe o nome do colaborador." }, 400);
  if (!/^[a-z0-9._-]{3,30}$/.test(username)) return json({ error: "O usuário deve ter de 3 a 30 caracteres e usar apenas letras, números, ponto, hífen ou underline." }, 400);
  if (password.length < 8) return json({ error: "A senha deve ter pelo menos 8 caracteres." }, 400);
  if (!role) return json({ error: "Função inválida." }, 400);

  const { data: existing } = await admin.from("collaborators").select("id, owner_id, auth_user_id").eq("username", username).maybeSingle();
  if (existing?.auth_user_id) return json({ error: "Este usuário já está em uso." }, 409);
  if (existing && existing.owner_id !== owner.id) return json({ error: "Este usuário já está em uso." }, 409);

  const internalEmail = `${username}@colaborador.sacoleiro.app`;
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: internalEmail,
    password,
    email_confirm: true,
    user_metadata: { full_name: name, collaborator_username: username },
  });

  if (createError || !created.user) {
    const message = createError?.message?.toLowerCase() ?? "";
    if (message.includes("already") || message.includes("registered")) return json({ error: "Este usuário já está em uso." }, 409);
    return json({ error: "Não foi possível criar o acesso do colaborador." }, 400);
  }

  const now = new Date().toISOString();
  const values = {
    owner_id: owner.id,
    auth_user_id: created.user.id,
    name,
    username,
    email: internalEmail,
    phone,
    role,
    is_active: true,
    invite_token: null,
    invite_expires_at: null,
    accepted_at: now,
  };

  const write = existing
    ? admin.from("collaborators").update(values).eq("id", existing.id)
    : admin.from("collaborators").insert(values);
  const { error: writeError } = await write;

  if (writeError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return json({ error: "Não foi possível salvar o colaborador." }, 400);
  }

  return json({ ok: true, collaborator: { name, username, role } }, existing ? 200 : 201);
});
