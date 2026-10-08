-- "Receber + vender": o pagamento passa a seguir a mesma regra do recebimento
-- normal. Antes, se o valor recebido fosse maior que o saldo da parcela, dava
-- o erro "O pagamento é maior que o saldo atual da parcela". Agora o excedente
-- é abatido nas próximas parcelas do cliente.
-- Pode ser executada mais de uma vez com segurança.

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
security definer
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

  -- Mesma regra do recebimento normal: o valor a mais é abatido nas
  -- próximas parcelas em aberto do cliente (antes da nova compra ser criada).
  perform public.register_payment(
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

revoke all on function public.register_payment_with_purchase(uuid, numeric, public.sale_payment_method, date, text, jsonb, public.sale_payment_method, numeric, integer, date, text) from public, anon;
grant execute on function public.register_payment_with_purchase(uuid, numeric, public.sale_payment_method, date, text, jsonb, public.sale_payment_method, numeric, integer, date, text) to authenticated;
