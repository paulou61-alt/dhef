-- =====================================================================
-- Liberar o número da ficha quando o cliente quita tudo.
--
-- customers.ficha_released = true quando o cliente já comprou e não tem
-- nenhuma parcela em aberto. Enquanto estiver liberada:
--   * o número dela pode ser usado em um novo cadastro;
--   * o número do cliente quitado pode ser trocado na edição.
-- Se o cliente quitado voltar a comprar, a ficha volta a ficar ativa.
-- Se o número dele já estiver com outro cliente ativo, a operação é
-- recusada com uma mensagem pedindo para trocar o número primeiro.
--
-- Pode ser executada mais de uma vez com segurança.
-- =====================================================================

alter table public.customers
  add column if not exists ficha_released boolean not null default false;

-- Situação atual dos clientes.
update public.customers c
set ficha_released = true
where not c.ficha_released
  and exists (
    select 1 from public.sales s
    where s.customer_id = c.id and s.status <> 'cancelled'
  )
  and not exists (
    select 1
    from public.installments i
    join public.sales s on s.id = i.sale_id
    where s.customer_id = c.id
      and s.status <> 'cancelled'
      and i.status in ('pendente', 'parcial', 'vencido')
      and i.amount - i.paid_amount > 0
  );

-- A numeração só precisa ser única entre as fichas ativas.
drop index if exists public.customers_owner_collaborator_ficha_key;
drop index if exists public.customers_owner_unassigned_ficha_key;

create unique index if not exists customers_owner_collaborator_active_ficha_key
  on public.customers (user_id, assigned_collaborator_id, ficha_number)
  where assigned_collaborator_id is not null and not ficha_released;

create unique index if not exists customers_owner_unassigned_active_ficha_key
  on public.customers (user_id, ficha_number)
  where assigned_collaborator_id is null and not ficha_released;

-- Recalcula se a ficha de um cliente está liberada.
create or replace function private.refresh_customer_ficha_release(p_customer_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_released boolean;
  v_customer public.customers%rowtype;
begin
  if p_customer_id is null then
    return;
  end if;

  select exists (
      select 1 from public.sales s
      where s.customer_id = p_customer_id and s.status <> 'cancelled'
    )
    and not exists (
      select 1
      from public.installments i
      join public.sales s on s.id = i.sale_id
      where s.customer_id = p_customer_id
        and s.status <> 'cancelled'
        and i.status in ('pendente', 'parcial', 'vencido')
        and i.amount - i.paid_amount > 0
    )
  into v_released;

  begin
    update public.customers
    set ficha_released = v_released
    where id = p_customer_id
      and ficha_released is distinct from v_released
    returning * into v_customer;
  exception when unique_violation then
    select * into v_customer from public.customers where id = p_customer_id;
    raise exception 'A ficha #% já está em uso por outro cliente. Troque o número da ficha de % antes de lançar uma nova compra.',
      v_customer.ficha_number, v_customer.name;
  end;
end;
$function$;

revoke all on function private.refresh_customer_ficha_release(uuid) from public, anon, authenticated;

create or replace function private.trg_installments_ficha_release()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_customer_id uuid;
begin
  select s.customer_id into v_customer_id
  from public.sales s
  where s.id = coalesce(new.sale_id, old.sale_id);

  perform private.refresh_customer_ficha_release(v_customer_id);
  return null;
end;
$function$;

create or replace function private.trg_sales_ficha_release()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    perform private.refresh_customer_ficha_release(new.customer_id);
  end if;
  if tg_op in ('UPDATE', 'DELETE') and old.customer_id is distinct from new.customer_id then
    perform private.refresh_customer_ficha_release(old.customer_id);
  end if;
  return null;
end;
$function$;

drop trigger if exists trg_installments_ficha_release on public.installments;
create trigger trg_installments_ficha_release
  after insert or update or delete on public.installments
  for each row execute function private.trg_installments_ficha_release();

drop trigger if exists trg_sales_ficha_release on public.sales;
create trigger trg_sales_ficha_release
  after insert or update of status, customer_id or delete on public.sales
  for each row execute function private.trg_sales_ficha_release();

-- Permite trocar o número da ficha de um cliente quitado.
-- Ajusta a função existente sem reescrevê-la: só acrescenta a condição
-- na verificação que trava a troca do número.
do $$
declare
  v_def text;
  v_old text := 'new.ficha_number is distinct from old.ficha_number then';
  v_new text := 'new.ficha_number is distinct from old.ficha_number and not coalesce(old.ficha_released, false) then';
begin
  select pg_get_functiondef('private.prepare_customer_ficha()'::regprocedure) into v_def;
  if position(v_new in v_def) > 0 then
    return; -- já ajustada
  end if;
  if position(v_old in v_def) = 0 then
    raise notice 'prepare_customer_ficha não tem a trava esperada; nada foi alterado nela.';
    return;
  end if;
  execute replace(v_def, v_old, v_new);
end;
$$;
