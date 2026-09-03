create or replace function public.create_customer_opening_balance(
  p_customer_id uuid,
  p_amount numeric,
  p_due_date date default current_date
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_owner_id uuid := private.current_owner_id();
  v_role text := private.current_access_role();
  v_collaborator_id uuid := private.current_collaborator_id();
  v_sale_id uuid;
  v_sale_number bigint;
begin
  if auth.uid() is null or v_owner_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  if v_role not in ('owner', 'vendedor') then
    raise exception 'Sem permissão para cadastrar saldo devedor';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Saldo devedor deve ser maior que zero';
  end if;

  if not exists (
    select 1
    from public.customers
    where id = p_customer_id
      and user_id = v_owner_id
  ) then
    raise exception 'Cliente não encontrado';
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
    created_by_collaborator_id
  )
  values (
    v_owner_id,
    p_customer_id,
    v_sale_number,
    'completed',
    'fiado',
    p_amount,
    p_amount,
    0,
    false,
    'Saldo devedor inicial do cadastro',
    case when v_role = 'vendedor' then v_collaborator_id else null end
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
  )
  values (
    v_owner_id,
    v_sale_id,
    1,
    1,
    p_amount,
    0,
    coalesce(p_due_date, current_date),
    'pendente'
  );

  return v_sale_id;
end;
$function$;

grant execute on function public.create_customer_opening_balance(uuid, numeric, date) to authenticated;
