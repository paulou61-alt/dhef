-- =====================================================================
-- Assinaturas (Stripe) e período de teste.
--
-- Cada dono de empresa tem uma linha em public.subscriptions:
--   status 'trial'     -> teste grátis do Cobrei (sem cartão), até trial_ends_at
--   status 'cortesia'  -> acesso liberado sem cobrança (contas que já existiam)
--   demais status      -> os mesmos do Stripe (active, trialing, past_due,
--                         canceled, unpaid, incomplete, incomplete_expired, paused)
--
-- Só o servidor (webhook do Stripe, com a chave service_role) altera a
-- tabela. O site apenas lê a linha da própria empresa.
--
-- IMPORTANTE: rode ANTES de abrir o cadastro público. As contas que já
-- existem no momento em que este SQL rodar recebem 'cortesia'.
-- Pode ser executada mais de uma vez com segurança.
-- =====================================================================

create table if not exists public.subscriptions (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'trial',
  plan text,
  billing_interval text,
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

revoke all on table public.subscriptions from anon, authenticated;
grant select on table public.subscriptions to authenticated;

-- Dono e colaboradores leem a assinatura da própria empresa (para saber se o acesso está liberado).
drop policy if exists subscriptions_select_company on public.subscriptions;
create policy subscriptions_select_company on public.subscriptions
  for select to authenticated
  using (owner_id = (select private.current_owner_id()));

drop trigger if exists trg_subscriptions_updated_at on public.subscriptions;
create trigger trg_subscriptions_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- Contas de dono que já existem: acesso de cortesia.
insert into public.subscriptions (owner_id, status)
select p.id, 'cortesia'
from public.profiles p
where not exists (select 1 from public.collaborators c where c.auth_user_id = p.id)
on conflict (owner_id) do nothing;

-- Inicia o teste grátis de 7 dias para o dono que ainda não tem assinatura.
create or replace function public.start_trial()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_owner_id uuid := private.current_owner_id();
begin
  if auth.uid() is null or v_owner_id is null or private.current_access_role() <> 'owner' then
    return;
  end if;

  insert into public.subscriptions (owner_id, status, trial_ends_at)
  values (v_owner_id, 'trial', now() + interval '7 days')
  on conflict (owner_id) do nothing;
end;
$function$;

revoke all on function public.start_trial() from public, anon;
grant execute on function public.start_trial() to authenticated;
