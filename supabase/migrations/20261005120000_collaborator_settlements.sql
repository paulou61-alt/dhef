-- Acerto (quitar) com colaboradores: comissão do período menos os vales.
-- Vendedor ganha % sobre as vendas; cobrador ganha % sobre o que recebeu dos clientes.
-- Ao quitar, o acerto fica registrado e o saldo de vale volta a zero.
-- Pode ser executada mais de uma vez com segurança.

create table if not exists public.collaborator_settlements (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  collaborator_id uuid not null references public.collaborators(id) on delete cascade,
  period_start date,
  period_end date not null,
  base_amount numeric(12,2) not null,
  commission_percent numeric(5,2) not null,
  commission_amount numeric(12,2) not null,
  vale_balance numeric(12,2) not null,
  result numeric(12,2) not null,
  created_at timestamptz not null default now()
);

create index if not exists collaborator_settlements_collaborator_idx
  on public.collaborator_settlements(collaborator_id, period_end desc);

alter table public.collaborator_settlements enable row level security;
revoke all on table public.collaborator_settlements from anon, authenticated;
grant select on table public.collaborator_settlements to authenticated;

drop policy if exists collaborator_settlements_select_owner on public.collaborator_settlements;
create policy collaborator_settlements_select_owner
on public.collaborator_settlements
for select
to authenticated
using (
  owner_id = (select auth.uid())
  and (select private.current_access_role()) = 'owner'
);

-- Conta do acerto (não grava nada).
create or replace function public.collaborator_settlement_preview(
  p_collaborator_id uuid,
  p_period_end date default current_date
)
returns table (
  role text,
  period_start date,
  period_end date,
  base_amount numeric,
  vale_balance numeric,
  last_percent numeric
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_owner_id uuid := private.current_owner_id();
  v_role text;
  v_start date;
  v_base numeric(12,2);
  v_balance numeric(12,2);
  v_percent numeric(5,2);
begin
  if auth.uid() is null or v_owner_id is null or private.current_access_role() <> 'owner' then
    raise exception 'Apenas o proprietário pode fazer acertos';
  end if;

  select c.role into v_role from public.collaborators c where c.id = p_collaborator_id and c.owner_id = v_owner_id;
  if v_role is null then raise exception 'Colaborador não encontrado'; end if;

  select s.period_end + 1, s.commission_percent
    into v_start, v_percent
  from public.collaborator_settlements s
  where s.collaborator_id = p_collaborator_id and s.owner_id = v_owner_id
  order by s.period_end desc, s.created_at desc
  limit 1;

  if v_role = 'cobrador' then
    select coalesce(sum(p.amount), 0) into v_base
    from public.payments p
    where p.user_id = v_owner_id
      and p.collected_by_collaborator_id = p_collaborator_id
      and (v_start is null or p.payment_date >= v_start)
      and p.payment_date <= p_period_end;
  else
    -- Mesma regra da tela: venda feita pelo colaborador ou, se lançada pelo dono, do cliente da carteira dele.
    select coalesce(sum(s.total), 0) into v_base
    from public.sales s
    left join public.customers c on c.id = s.customer_id
    where s.user_id = v_owner_id
      and s.status <> 'cancelled'
      and not coalesce(s.is_opening_balance, false)
      and coalesce(s.created_by_collaborator_id, c.assigned_collaborator_id) = p_collaborator_id
      and (v_start is null or (s.created_at at time zone 'America/Sao_Paulo')::date >= v_start)
      and (s.created_at at time zone 'America/Sao_Paulo')::date <= p_period_end;
  end if;

  select coalesce(sum(case when m.movement_type = 'vale' then -m.amount else m.amount end), 0)
    into v_balance
  from public.collaborator_vale_movements m
  where m.owner_id = v_owner_id and m.collaborator_id = p_collaborator_id;

  return query select v_role, v_start, p_period_end, v_base::numeric, v_balance::numeric, coalesce(v_percent, 0)::numeric;
end;
$function$;

-- Quita: registra o acerto e zera o saldo de vale. Tudo ou nada.
create or replace function public.settle_collaborator(
  p_collaborator_id uuid,
  p_commission_percent numeric,
  p_period_end date default current_date
)
returns numeric
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_owner_id uuid := private.current_owner_id();
  v_preview record;
  v_commission numeric(12,2);
  v_result numeric(12,2);
  v_label text;
begin
  if p_commission_percent is null or p_commission_percent < 0 or p_commission_percent > 100 then
    raise exception 'Percentual de comissão inválido';
  end if;
  if p_period_end is null or p_period_end > current_date then
    raise exception 'Data final do acerto inválida';
  end if;

  -- Evita dois acertos ao mesmo tempo para o mesmo colaborador.
  perform pg_advisory_xact_lock(hashtextextended('settle:' || p_collaborator_id::text, 0));

  select * into v_preview from public.collaborator_settlement_preview(p_collaborator_id, p_period_end);
  if v_preview.period_start is not null and v_preview.period_start > p_period_end then
    raise exception 'Este período já foi acertado';
  end if;

  v_commission := round(v_preview.base_amount * p_commission_percent / 100, 2);
  v_result := v_preview.vale_balance + v_commission;
  v_label := 'acerto até ' || to_char(p_period_end, 'DD/MM/YYYY');

  insert into public.collaborator_settlements (
    owner_id, collaborator_id, period_start, period_end, base_amount,
    commission_percent, commission_amount, vale_balance, result
  ) values (
    v_owner_id, p_collaborator_id, v_preview.period_start, p_period_end, v_preview.base_amount,
    p_commission_percent, v_commission, v_preview.vale_balance, v_result
  );

  if v_commission > 0 then
    insert into public.collaborator_vale_movements (owner_id, collaborator_id, movement_type, amount, movement_date, notes)
    values (v_owner_id, p_collaborator_id, 'abatimento', v_commission, current_date,
      'Comissão ' || replace(to_char(p_commission_percent, 'FM990.##'), '.', ',') || '% · ' || v_label);
  end if;

  if v_result > 0 then
    insert into public.collaborator_vale_movements (owner_id, collaborator_id, movement_type, amount, movement_date, notes)
    values (v_owner_id, p_collaborator_id, 'vale', v_result, current_date, 'Pago ao colaborador · ' || v_label);
  elsif v_result < 0 then
    insert into public.collaborator_vale_movements (owner_id, collaborator_id, movement_type, amount, movement_date, notes)
    values (v_owner_id, p_collaborator_id, 'abatimento', -v_result, current_date, 'Devolvido pelo colaborador · ' || v_label);
  end if;

  return v_result;
end;
$function$;

revoke all on function public.collaborator_settlement_preview(uuid, date) from public, anon;
grant execute on function public.collaborator_settlement_preview(uuid, date) to authenticated;
revoke all on function public.settle_collaborator(uuid, numeric, date) from public, anon;
grant execute on function public.settle_collaborator(uuid, numeric, date) to authenticated;
