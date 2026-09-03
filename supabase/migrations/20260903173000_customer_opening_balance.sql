alter table public.customers
  add column if not exists opening_balance numeric(12,2) not null default 0;

alter table public.customers
  drop constraint if exists customers_opening_balance_nonnegative;

alter table public.customers
  add constraint customers_opening_balance_nonnegative
  check (opening_balance >= 0);

alter table public.sales
  add column if not exists is_opening_balance boolean not null default false;

create or replace function private.create_customer_opening_balance()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $$
declare
  v_sale_id uuid;
  v_sale_number bigint;
begin
  if coalesce(new.opening_balance, 0) <= 0 then
    return new;
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
    new.user_id,
    new.id,
    v_sale_number,
    'completed',
    'fiado',
    new.opening_balance,
    new.opening_balance,
    0,
    false,
    'Saldo devedor inicial',
    null,
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
    new.user_id,
    v_sale_id,
    1,
    1,
    new.opening_balance,
    0,
    current_date,
    'pendente'
  );

  return new;
end;
$$;

drop trigger if exists trg_create_customer_opening_balance on public.customers;

create trigger trg_create_customer_opening_balance
after insert on public.customers
for each row
when (new.opening_balance > 0)
execute function private.create_customer_opening_balance();
