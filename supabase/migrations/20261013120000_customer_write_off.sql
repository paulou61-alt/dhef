-- Cliente "prego" (não paga) ou "mudou": sai das cobranças e libera a ficha,
-- mesmo com valor em aberto. A dívida continua registrada na ficha e o
-- cliente pode ser reativado depois.
-- Pode ser executada mais de uma vez com segurança.

alter table public.customers add column if not exists write_off_status text;
alter table public.customers add column if not exists write_off_at timestamptz;
alter table public.customers add column if not exists write_off_note text;

alter table public.customers drop constraint if exists customers_write_off_status_check;
alter table public.customers add constraint customers_write_off_status_check
  check (write_off_status is null or write_off_status in ('prego', 'mudou'));

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

  -- Cliente marcado como prego ou mudou: a ficha fica liberada mesmo com dívida.
  select (c.write_off_status is not null) or (exists (
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
    ))
  from public.customers c
  where c.id = p_customer_id
  into v_released;

  if v_released is null then
    return;
  end if;

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

create or replace function public.set_customer_write_off(
  p_customer_id uuid,
  p_status text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_owner_id uuid := private.current_owner_id();
begin
  if auth.uid() is null or v_owner_id is null or private.current_access_role() <> 'owner' then
    raise exception 'Apenas o proprietário pode alterar a situação do cliente';
  end if;
  if p_status is not null and p_status not in ('prego', 'mudou') then
    raise exception 'Situação inválida';
  end if;

  update public.customers
  set write_off_status = p_status,
      write_off_at = case when p_status is null then null else now() end,
      write_off_note = case when p_status is null then null else nullif(btrim(coalesce(p_note, '')), '') end
  where id = p_customer_id and user_id = v_owner_id;

  if not found then raise exception 'Cliente não encontrado'; end if;

  -- Ao marcar, libera a ficha; ao reativar, volta a ocupar o número
  -- (dá erro se o número já foi usado por outro cliente).
  perform private.refresh_customer_ficha_release(p_customer_id);
end;
$function$;

revoke all on function public.set_customer_write_off(uuid, text, text) from public, anon;
grant execute on function public.set_customer_write_off(uuid, text, text) to authenticated;
