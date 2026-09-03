create or replace function public.initialize_customer_account(
  p_customer_id uuid,
  p_opening_balance numeric default 0,
  p_items jsonb default '[]'::jsonb,
  p_payment_method public.sale_payment_method default 'parcelado',
  p_down_payment numeric default 0,
  p_installments_count integer default 1,
  p_first_due_date date default current_date,
  p_notes text default null
)
returns uuid
language plpgsql
set search_path = pg_catalog, public, private
as $function$
declare
  v_owner_id uuid := private.current_owner_id();
  v_role text := private.current_access_role();
  v_customer public.customers%rowtype;
  v_sale_id uuid;
begin
  if auth.uid() is null or v_owner_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  if v_role not in ('owner', 'vendedor') then
    raise exception 'Sem permissão para inicializar a conta do cliente';
  end if;

  select * into v_customer
  from public.customers
  where id = p_customer_id and user_id = v_owner_id;

  if v_customer.id is null then
    raise exception 'Cliente não encontrado';
  end if;

  if v_role = 'vendedor'
     and v_customer.assigned_collaborator_id is distinct from private.current_collaborator_id() then
    raise exception 'Cliente não pertence a este colaborador';
  end if;

  if coalesce(p_opening_balance, 0) > 0 then
    perform public.create_customer_opening_balance(
      p_customer_id,
      round(p_opening_balance, 2),
      coalesce(p_first_due_date, current_date)
    );
  end if;

  if p_items is not null
     and jsonb_typeof(p_items) = 'array'
     and jsonb_array_length(p_items) > 0 then
    v_sale_id := public.create_sale(
      p_customer_id,
      p_items,
      p_payment_method,
      coalesce(p_down_payment, 0),
      greatest(coalesce(p_installments_count, 1), 1),
      coalesce(p_first_due_date, current_date),
      p_notes
    );
  end if;

  return v_sale_id;
end;
$function$;

revoke all on function public.initialize_customer_account(uuid, numeric, jsonb, public.sale_payment_method, numeric, integer, date, text) from public;
grant execute on function public.initialize_customer_account(uuid, numeric, jsonb, public.sale_payment_method, numeric, integer, date, text) to authenticated;

create or replace function private.create_collection_sale_impl(
  p_customer_id uuid,
  p_items jsonb,
  p_payment_method public.sale_payment_method,
  p_down_payment numeric default 0,
  p_installments_count integer default 1,
  p_first_due_date date default current_date,
  p_notes text default null
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
  v_customer public.customers%rowtype;
  v_sale_id uuid;
  v_sale_number bigint;
  v_item jsonb;
  v_variant record;
  v_qty integer;
  v_subtotal numeric(12,2) := 0;
  v_item_subtotal numeric(12,2);
  v_remaining numeric(12,2);
  v_installment_amount numeric(12,2);
  v_i integer;
  v_due_date date;
  v_is_paid boolean := false;
begin
  if auth.uid() is null or v_owner_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  if v_role not in ('owner', 'cobrador') then
    raise exception 'Sem permissão para registrar compra durante a cobrança';
  end if;

  select * into v_customer
  from public.customers
  where id = p_customer_id and user_id = v_owner_id;

  if v_customer.id is null then
    raise exception 'Cliente não encontrado';
  end if;

  if v_role = 'cobrador'
     and v_customer.assigned_collaborator_id is distinct from v_collaborator_id then
    raise exception 'Cliente não pertence à carteira deste cobrador';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'A nova compra precisa ter ao menos um item';
  end if;

  if coalesce(p_down_payment, 0) < 0 then
    raise exception 'Entrada inválida';
  end if;

  if p_payment_method = 'parcelado' and coalesce(p_installments_count, 0) < 1 then
    raise exception 'Quantidade de parcelas inválida';
  end if;

  v_sale_number := nextval('public.sale_number_seq');

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::integer;
    if v_qty is null or v_qty <= 0 then
      raise exception 'Quantidade inválida';
    end if;

    select pv.*, p.sale_price as product_price
      into v_variant
    from public.product_variants pv
    join public.products p on p.id = pv.product_id
    where pv.id = (v_item->>'product_variant_id')::uuid
      and pv.user_id = v_owner_id
    for update of pv;

    if v_variant is null then
      raise exception 'Variante de produto não encontrada';
    end if;

    if v_variant.stock_quantity < v_qty then
      raise exception 'Estoque insuficiente para %: disponível %, solicitado %',
        v_variant.variant_name, v_variant.stock_quantity, v_qty;
    end if;

    v_subtotal := v_subtotal + (coalesce(v_variant.sale_price, v_variant.product_price) * v_qty);
  end loop;

  if coalesce(p_down_payment, 0) > v_subtotal then
    raise exception 'Entrada não pode ser maior que o total da venda';
  end if;

  if p_payment_method in ('pix', 'dinheiro', 'cartao') then
    v_is_paid := true;
  end if;

  insert into public.sales (
    user_id, customer_id, sale_number, status, payment_method, subtotal, total,
    down_payment, is_paid, notes, created_by_collaborator_id
  ) values (
    v_owner_id, p_customer_id, v_sale_number, 'completed', p_payment_method,
    v_subtotal, v_subtotal, coalesce(p_down_payment, 0), v_is_paid, p_notes, null
  )
  returning id into v_sale_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::integer;

    select pv.*, p.name as product_name, p.cost_price as product_cost, p.sale_price as product_price
      into v_variant
    from public.product_variants pv
    join public.products p on p.id = pv.product_id
    where pv.id = (v_item->>'product_variant_id')::uuid
      and pv.user_id = v_owner_id;

    v_item_subtotal := coalesce(v_variant.sale_price, v_variant.product_price) * v_qty;

    insert into public.sale_items (
      user_id, sale_id, product_variant_id, product_name_snapshot, variant_name_snapshot,
      quantity, unit_cost_snapshot, unit_price_snapshot, subtotal
    ) values (
      v_owner_id, v_sale_id, v_variant.id, v_variant.product_name, v_variant.variant_name,
      v_qty, coalesce(v_variant.cost_price, v_variant.product_cost),
      coalesce(v_variant.sale_price, v_variant.product_price), v_item_subtotal
    );

    update public.product_variants
    set stock_quantity = stock_quantity - v_qty
    where id = v_variant.id;

    insert into public.inventory_movements (
      user_id, product_variant_id, type, quantity, reason, sale_id
    ) values (
      v_owner_id, v_variant.id, 'venda', -v_qty,
      'Venda #' || v_sale_number, v_sale_id
    );
  end loop;

  if p_payment_method = 'fiado' then
    v_remaining := v_subtotal - coalesce(p_down_payment, 0);
    if v_remaining > 0 then
      insert into public.installments (
        user_id, sale_id, installment_number, total_installments, amount, due_date, status
      ) values (
        v_owner_id, v_sale_id, 1, 1, v_remaining,
        coalesce(p_first_due_date, current_date), 'pendente'
      );
    end if;
  elsif p_payment_method = 'parcelado' then
    v_remaining := v_subtotal - coalesce(p_down_payment, 0);
    v_installment_amount := round(v_remaining / p_installments_count, 2);

    for v_i in 1..p_installments_count loop
      v_due_date := coalesce(p_first_due_date, current_date) + ((v_i - 1) * interval '1 month');
      insert into public.installments (
        user_id, sale_id, installment_number, total_installments, amount, due_date, status
      ) values (
        v_owner_id, v_sale_id, v_i, p_installments_count,
        case
          when v_i = p_installments_count
            then v_remaining - (v_installment_amount * (p_installments_count - 1))
          else v_installment_amount
        end,
        v_due_date, 'pendente'
      );
    end loop;
  end if;

  if v_is_paid then
    insert into public.cash_movements (
      user_id, type, origin, amount, description, reference_id
    ) values (
      v_owner_id, 'entrada', 'venda', v_subtotal,
      'Venda #' || v_sale_number, v_sale_id
    );
  elsif coalesce(p_down_payment, 0) > 0 then
    insert into public.cash_movements (
      user_id, type, origin, amount, description, reference_id
    ) values (
      v_owner_id, 'entrada', 'venda', p_down_payment,
      'Entrada venda #' || v_sale_number, v_sale_id
    );
  end if;

  return v_sale_id;
end;
$function$;

create or replace function public.register_payment_with_purchase(
  p_installment_id uuid,
  p_amount numeric,
  p_payment_method public.sale_payment_method,
  p_payment_date date default current_date,
  p_notes text default null,
  p_items jsonb default '[]'::jsonb,
  p_purchase_payment_method public.sale_payment_method default 'parcelado',
  p_purchase_down_payment numeric default 0,
  p_purchase_installments_count integer default 1,
  p_purchase_first_due_date date default current_date,
  p_purchase_notes text default null
)
returns uuid
language plpgsql
set search_path = pg_catalog, public, private
as $function$
declare
  v_owner_id uuid := private.current_owner_id();
  v_role text := private.current_access_role();
  v_customer_id uuid;
  v_sale_id uuid;
begin
  if auth.uid() is null or v_owner_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  if v_role not in ('owner', 'cobrador') then
    raise exception 'Sem permissão para registrar recebimentos';
  end if;

  select s.customer_id
    into v_customer_id
  from public.installments i
  join public.sales s on s.id = i.sale_id
  where i.id = p_installment_id
    and i.user_id = v_owner_id
    and s.user_id = v_owner_id;

  if v_customer_id is null then
    raise exception 'Cliente da parcela não encontrado';
  end if;

  perform private.register_payment_impl(
    p_installment_id,
    p_amount,
    p_payment_method,
    coalesce(p_payment_date, current_date),
    p_notes
  );

  if p_items is not null
     and jsonb_typeof(p_items) = 'array'
     and jsonb_array_length(p_items) > 0 then
    v_sale_id := private.create_collection_sale_impl(
      v_customer_id,
      p_items,
      p_purchase_payment_method,
      coalesce(p_purchase_down_payment, 0),
      greatest(coalesce(p_purchase_installments_count, 1), 1),
      coalesce(p_purchase_first_due_date, current_date),
      p_purchase_notes
    );
  end if;

  return v_sale_id;
end;
$function$;

revoke all on function public.register_payment_with_purchase(uuid, numeric, public.sale_payment_method, date, text, jsonb, public.sale_payment_method, numeric, integer, date, text) from public;
grant execute on function public.register_payment_with_purchase(uuid, numeric, public.sale_payment_method, date, text, jsonb, public.sale_payment_method, numeric, integer, date, text) to authenticated;

create or replace function public.process_offline_operation(
  p_operation_id uuid,
  p_operation_type text,
  p_payload jsonb
)
returns jsonb
language plpgsql
set search_path to 'public'
as $function$
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

  if p_operation_type not in ('sale', 'payment', 'payment_purchase', 'expense') then
    raise exception 'Tipo de operação offline inválido.';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(v_user_id::text || ':' || p_operation_id::text, 0)
  );

  select * into v_existing
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
        coalesce(nullif(p_payload ->> 'firstDueDate', '')::date, current_date),
        nullif(btrim(coalesce(p_payload ->> 'notes', '')), '')
      );

    when 'payment' then
      perform public.register_payment(
        (p_payload ->> 'installmentId')::uuid,
        (p_payload ->> 'amount')::numeric,
        (p_payload ->> 'paymentMethod')::public.sale_payment_method,
        coalesce(nullif(p_payload ->> 'paymentDate', '')::date, current_date),
        nullif(btrim(coalesce(p_payload ->> 'notes', '')), '')
      );
      v_result_id := null;

    when 'payment_purchase' then
      v_result_id := public.register_payment_with_purchase(
        (p_payload ->> 'installmentId')::uuid,
        (p_payload ->> 'amount')::numeric,
        (p_payload ->> 'paymentMethod')::public.sale_payment_method,
        coalesce(nullif(p_payload ->> 'paymentDate', '')::date, current_date),
        nullif(btrim(coalesce(p_payload ->> 'notes', '')), ''),
        coalesce(p_payload -> 'items', '[]'::jsonb),
        coalesce(nullif(p_payload ->> 'purchasePaymentMethod', '')::public.sale_payment_method, 'parcelado'),
        coalesce(nullif(p_payload ->> 'purchaseDownPayment', '')::numeric, 0),
        greatest(coalesce(nullif(p_payload ->> 'purchaseInstallmentsCount', '')::integer, 1), 1),
        coalesce(nullif(p_payload ->> 'purchaseFirstDueDate', '')::date, current_date),
        nullif(btrim(coalesce(p_payload ->> 'purchaseNotes', '')), '')
      );

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
    user_id, operation_id, operation_type, result_id
  ) values (
    v_user_id, p_operation_id, p_operation_type, v_result_id
  );

  return jsonb_build_object(
    'operationId', p_operation_id,
    'alreadyProcessed', false,
    'resultId', v_result_id
  );
end;
$function$;
