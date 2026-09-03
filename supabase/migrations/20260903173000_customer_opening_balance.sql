alter table public.sales
  add column if not exists is_opening_balance boolean not null default false;

create index if not exists sales_opening_balance_customer_idx
  on public.sales (customer_id)
  where is_opening_balance = true and status <> 'cancelled';

create or replace function public.create_customer_opening_balance(
  p_customer_id uuid,
  p_amount numeric,
  p_due_date date default current_date
)
returns uuid
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $$
declare
  v_owner_id uuid := private.current_owner_id();
  v_role text := private.current_access_role();
  v_collaborator_id uuid := private.current_collaborator_id();
  v_customer public.customers%rowtype;
  v_sale_id uuid;
  v_sale_number bigint;
begin
  if auth.uid() is null or v_owner_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  if v_role not in ('owner', 'vendedor') then
    raise exception 'Sem permissão para cadastrar saldo devedor inicial';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Saldo devedor inicial deve ser maior que zero';
  end if;

  select * into v_customer
  from public.customers
  where id = p_customer_id and user_id = v_owner_id;

  if v_customer.id is null then
    raise exception 'Cliente não encontrado';
  end if;

  if v_role = 'vendedor' and v_customer.assigned_collaborator_id is distinct from v_collaborator_id then
    raise exception 'Cliente não pertence a este colaborador';
  end if;

  if exists (
    select 1
    from public.sales
    where user_id = v_owner_id
      and customer_id = p_customer_id
      and is_opening_balance = true
      and status <> 'cancelled'
  ) then
    raise exception 'Este cliente já possui saldo devedor inicial cadastrado';
  end if;

  v_sale_number := nextval('public.sale_number_seq');

  insert into public.sales (
    user_id,
    customer_id,
    sale_number,
    status,
    payment_method,
    subtotal,
    total,
    down_payment,
    is_paid,
    notes,
    created_by_collaborator_id,
    is_opening_balance
  ) values (
    v_owner_id,
    p_customer_id,
    v_sale_number,
    'completed',
    'fiado',
    round(p_amount, 2),
    round(p_amount, 2),
    0,
    false,
    'Saldo devedor inicial',
    case when v_role = 'vendedor' then v_collaborator_id else null end,
    true
  )
  returning id into v_sale_id;

  insert into public.installments (
    user_id,
    sale_id,
    installment_number,
    total_installments,
    amount,
    paid_amount,
    due_date,
    status
  ) values (
    v_owner_id,
    v_sale_id,
    1,
    1,
    round(p_amount, 2),
    0,
    coalesce(p_due_date, current_date),
    'pendente'
  );

  return v_sale_id;
end;
$$;

revoke all on function public.create_customer_opening_balance(uuid, numeric, date) from public;
grant execute on function public.create_customer_opening_balance(uuid, numeric, date) to authenticated;
