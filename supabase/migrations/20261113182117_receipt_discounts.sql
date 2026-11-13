-- Desconto concedido na janela de recebimento: abate a parcela selecionada.
-- Usa o mesmo histórico e o mesmo estorno dos descontos concedidos na ficha.
create function private.apply_receipt_discount(
  p_installment_id uuid, p_amount numeric, p_note text, p_request_id uuid
) returns uuid language plpgsql security invoker set search_path = '' as $function$
declare
  v_uid uuid := auth.uid();
  v_customer_id uuid;
  v_item public.installments%rowtype;
  v_previous public.customer_discounts%rowtype;
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if v_uid is null or private.current_access_role() <> 'owner' then
    raise exception 'Apenas o proprietário pode conceder descontos';
  end if;
  if p_amount is null or p_amount::text in ('NaN','Infinity','-Infinity')
    or p_amount <= 0 or p_amount > 9999999999.99 or round(p_amount, 2) <> p_amount then
    raise exception 'Informe um desconto maior que zero, com até duas casas decimais';
  end if;
  if p_request_id is null then raise exception 'Identificador de desconto inválido'; end if;
  select s.customer_id into v_customer_id from public.installments i
  join public.sales s on s.id = i.sale_id
  where i.id = p_installment_id and i.user_id = v_uid and s.user_id = v_uid and s.status = 'completed';
  if v_customer_id is null then raise exception 'Cliente da parcela não encontrado'; end if;
  -- Mesma ordem de bloqueios do desconto concedido na ficha.
  perform i.id from public.installments i join public.sales s on s.id = i.sale_id
  where s.customer_id = v_customer_id and i.user_id = v_uid and s.user_id = v_uid and s.status = 'completed'
  order by i.id for update of i;
  perform c.id from public.customers c where c.id = v_customer_id and c.user_id = v_uid for update;
  select * into v_previous from public.customer_discounts where id = p_request_id;
  if found then
    if v_previous.customer_id <> v_customer_id or v_previous.user_id <> v_uid or v_previous.amount <> p_amount
      or v_previous.note is distinct from nullif(btrim(left(p_note, 240)), '')
      or not exists (select 1 from public.customer_discount_items d
        where d.discount_id = p_request_id and d.installment_id = p_installment_id and d.amount = p_amount) then
      raise exception 'Identificador de desconto já utilizado';
    end if;
    return p_request_id;
  end if;
  select * into v_item from public.installments where id = p_installment_id and user_id = v_uid;
  if v_item.id is null or v_item.status = 'pago' or p_amount > v_item.amount - v_item.paid_amount then
    raise exception 'O desconto não pode ser maior que o saldo atual da parcela';
  end if;
  insert into public.customer_discounts(id,user_id,customer_id,amount,note)
  values(p_request_id,v_uid,v_customer_id,p_amount,nullif(btrim(left(p_note,240)),''));
  insert into public.customer_discount_items(discount_id,installment_id,amount)
  values(p_request_id,p_installment_id,p_amount);
  update public.installments set amount = amount - p_amount,
    status = case when amount - p_amount <= paid_amount then 'pago'::public.installment_status
      when due_date < v_today then 'vencido'::public.installment_status
      when paid_amount > 0 then 'parcial'::public.installment_status
      else 'pendente'::public.installment_status end
  where id = p_installment_id and user_id = v_uid;
  return p_request_id;
end;
$function$;
revoke all on function private.apply_receipt_discount(uuid,numeric,text,uuid) from public,anon;
grant execute on function private.apply_receipt_discount(uuid,numeric,text,uuid) to authenticated;

CREATE OR REPLACE FUNCTION public.process_offline_operation(p_operation_id uuid, p_operation_type text, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_existing public.offline_sync_receipts%rowtype;
  v_result_id uuid;
  v_discount numeric;
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


  -- O abatimento e o recebimento pertencem à mesma transação e ao mesmo
  -- recibo idempotente. A nova compra só é criada depois dos dois.
  if p_operation_type in ('payment', 'payment_purchase') then
    v_discount := coalesce(nullif(p_payload ->> 'discountAmount', '')::numeric, 0);
    if v_discount::text in ('NaN', 'Infinity', '-Infinity') or v_discount < 0
       or round(v_discount, 2) <> v_discount then
      raise exception 'Informe um desconto válido, com até duas casas decimais';
    end if;
    if v_discount > 0 then
      if (p_payload ->> 'amount') is null
         or (p_payload ->> 'amount')::numeric <= 0
         or (p_payload ->> 'amount')::numeric::text in ('NaN', 'Infinity', '-Infinity')
         or round((p_payload ->> 'amount')::numeric, 2) <> (p_payload ->> 'amount')::numeric then
        raise exception 'Informe um valor recebido maior que zero, com até duas casas decimais';
      end if;
      perform private.apply_receipt_discount(
        (p_payload ->> 'installmentId')::uuid, v_discount,
        nullif(btrim(p_payload ->> 'discountNote'), ''), p_operation_id
      );
    end if;
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

revoke all on function public.process_offline_operation(uuid,text,jsonb) from public,anon;
grant execute on function public.process_offline_operation(uuid,text,jsonb) to authenticated;
