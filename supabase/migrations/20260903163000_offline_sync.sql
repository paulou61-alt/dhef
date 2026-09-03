-- Idempotência para operações criadas offline.
-- Esta migration deve ser aplicada no Supabase somente quando a branch dev for publicada.

create table if not exists public.offline_sync_receipts (
  user_id uuid not null references auth.users(id) on delete cascade,
  operation_id uuid not null,
  operation_type text not null check (operation_type in ('sale', 'payment', 'expense')),
  result_id uuid null,
  created_at timestamptz not null default now(),
  primary key (user_id, operation_id)
);

alter table public.offline_sync_receipts enable row level security;

drop policy if exists "offline receipts select own" on public.offline_sync_receipts;
create policy "offline receipts select own"
on public.offline_sync_receipts
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "offline receipts insert own" on public.offline_sync_receipts;
create policy "offline receipts insert own"
on public.offline_sync_receipts
for insert
to authenticated
with check (user_id = auth.uid());

revoke all on public.offline_sync_receipts from anon;
grant select, insert on public.offline_sync_receipts to authenticated;

create or replace function public.process_offline_operation(
  p_operation_id uuid,
  p_operation_type text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing public.offline_sync_receipts%rowtype;
  v_result_id uuid;
begin
  if v_user_id is null then
    raise exception 'Sessão expirada. Faça login novamente.';
  end if;

  if p_operation_id is null then
    raise exception 'ID da operação offline é obrigatório.';
  end if;

  if p_operation_type not in ('sale', 'payment', 'expense') then
    raise exception 'Tipo de operação offline inválido.';
  end if;

  -- Serializa tentativas da mesma operação para impedir duplicidade em retries.
  perform pg_advisory_xact_lock(
    hashtextextended(v_user_id::text || ':' || p_operation_id::text, 0)
  );

  select *
    into v_existing
  from public.offline_sync_receipts
  where user_id = v_user_id
    and operation_id = p_operation_id;

  if found then
    return jsonb_build_object(
      'operationId', p_operation_id,
      'alreadyProcessed', true,
      'resultId', v_existing.result_id
    );
  end if;

  case p_operation_type
    when 'sale' then
      v_result_id := public.create_sale(
        nullif(p_payload ->> 'customerId', '')::uuid,
        coalesce(p_payload -> 'items', '[]'::jsonb),
        (p_payload ->> 'paymentMethod')::public.sale_payment_method,
        coalesce(nullif(p_payload ->> 'downPayment', '')::numeric, 0),
        greatest(coalesce(nullif(p_payload ->> 'installmentsCount', '')::integer, 1), 1),
        (p_payload ->> 'firstDueDate')::date,
        nullif(btrim(coalesce(p_payload ->> 'notes', '')), '')
      );

    when 'payment' then
      perform public.register_payment(
        (p_payload ->> 'installmentId')::uuid,
        (p_payload ->> 'amount')::numeric,
        (p_payload ->> 'paymentMethod')::public.sale_payment_method,
        (p_payload ->> 'paymentDate')::date,
        nullif(btrim(coalesce(p_payload ->> 'notes', '')), '')
      );
      v_result_id := null;

    when 'expense' then
      v_result_id := public.register_expense(
        btrim(p_payload ->> 'description'),
        coalesce(nullif(btrim(p_payload ->> 'category'), ''), 'outros'),
        (p_payload ->> 'amount')::numeric,
        (p_payload ->> 'expenseDate')::date,
        nullif(btrim(coalesce(p_payload ->> 'notes', '')), '')
      );
  end case;

  insert into public.offline_sync_receipts (
    user_id,
    operation_id,
    operation_type,
    result_id
  ) values (
    v_user_id,
    p_operation_id,
    p_operation_type,
    v_result_id
  );

  return jsonb_build_object(
    'operationId', p_operation_id,
    'alreadyProcessed', false,
    'resultId', v_result_id
  );
end;
$$;

revoke all on function public.process_offline_operation(uuid, text, jsonb) from public;
grant execute on function public.process_offline_operation(uuid, text, jsonb) to authenticated;
