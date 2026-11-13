-- Testa o caminho real de sincronização usado pelo modal, sempre com rollback.
begin;
do $test$
declare
  v_owner uuid;
  v_customer uuid := gen_random_uuid();
  v_sale uuid := gen_random_uuid();
  v_old uuid := gen_random_uuid();
  v_selected uuid := gen_random_uuid();
  v_operation uuid := gen_random_uuid();
  v_invalid uuid := gen_random_uuid();
  v_partial uuid := gen_random_uuid();
  v_purchase uuid := gen_random_uuid();
  v_product uuid := gen_random_uuid();
  v_variant uuid := gen_random_uuid();
  v_new_sale uuid;
  v_result jsonb;
  v_ficha integer;
  v_denied boolean := false;
  v_collector uuid;
begin
  select c.user_id into v_owner from public.customers c
  where not exists(select 1 from public.collaborators x where x.auth_user_id=c.user_id) limit 1;
  select n into v_ficha from generate_series(1,1000) n where not exists(
    select 1 from public.customers c where c.user_id=v_owner and c.assigned_collaborator_id is null
      and not c.ficha_released and c.ficha_number=n) limit 1;
  if v_owner is null or v_ficha is null then raise exception 'Sem proprietário ou ficha para teste'; end if;
  insert into public.customers(id,user_id,name,ficha_number,ficha_released)
  values(v_customer,v_owner,'__TESTE_TRANSACIONAL_RECEBIMENTO_DESCONTO__',v_ficha,true);
  insert into public.sales(id,user_id,customer_id,sale_number,status,payment_method,subtotal,total,down_payment,is_paid)
  values(v_sale,v_owner,v_customer,-900000000002,'completed','parcelado',340,340,0,false);
  insert into public.installments(id,user_id,sale_id,installment_number,total_installments,amount,paid_amount,due_date,status)
  values(v_old,v_owner,v_sale,1,2,100,0,'2026-01-01','vencido'),
    (v_selected,v_owner,v_sale,2,2,240,0,'2099-01-01','pendente');
  insert into public.products(id,user_id,name,cost_price,sale_price,is_active)
  values(v_product,v_owner,'__TESTE_PRODUTO_RECEBIMENTO__',100,480,true);
  insert into public.product_variants(id,user_id,product_id,variant_name,stock_quantity)
  values(v_variant,v_owner,v_product,'Padrão',10);
  select auth_user_id into v_collector from public.collaborators where auth_user_id is not null limit 1;

  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_owner,'role','authenticated')::text,true);
  execute 'set local role authenticated';
  v_result := public.process_offline_operation(v_operation,'payment',jsonb_build_object(
    'installmentId',v_selected,'amount',200,'discountAmount',40,'discountNote','Acordo no recebimento',
    'paymentMethod','pix','paymentDate',current_date));
  if (select amount-paid_amount from public.installments where id=v_selected) <> 0
    or (select amount-paid_amount from public.installments where id=v_old) <> 100
    or (select sum(amount) from public.payments where installment_id=v_selected) <> 200
    or not exists(select 1 from public.customer_discount_items where discount_id=v_operation and installment_id=v_selected and amount=40) then
    raise exception 'Desconto não quitou a parcela selecionada ou afetou a parcela errada';
  end if;
  v_result := public.process_offline_operation(v_operation,'payment',jsonb_build_object(
    'installmentId',v_selected,'amount',200,'discountAmount',40,'paymentMethod','pix'));
  if not (v_result->>'alreadyProcessed')::boolean
    or (select count(*) from public.customer_discounts where customer_id=v_customer) <> 1
    or (select sum(amount) from public.payments where installment_id=v_selected) <> 200 then
    raise exception 'Retentativa duplicou recebimento ou desconto';
  end if;

  -- Falha no pagamento reverte também o desconto concedido antes dele.
  v_denied := false;
  begin
    perform public.process_offline_operation(v_invalid,'payment',jsonb_build_object(
      'installmentId',v_old,'amount',500,'discountAmount',10,'paymentMethod','pix'));
  exception when others then
    if sqlerrm like '%saldo total em aberto%' then v_denied:=true; else raise; end if;
  end;
  if not v_denied or (select amount-paid_amount from public.installments where id=v_old) <> 100
    or exists(select 1 from public.customer_discounts where id=v_invalid)
    or exists(select 1 from public.offline_sync_receipts where operation_id=v_invalid) then
    raise exception 'Falha no recebimento deixou desconto parcial salvo';
  end if;

  perform public.process_offline_operation(v_partial,'payment',jsonb_build_object(
    'installmentId',v_old,'amount',10,'discountAmount',20,'paymentMethod','pix'));
  if (select amount-paid_amount from public.installments where id=v_old) <> 70 then
    raise exception 'Saldo restante após recebimento parcial incorreto';
  end if;

  -- Desconto só na dívida anterior, seguido de uma compra nova de R$ 480.
  v_result := public.process_offline_operation(v_purchase,'payment_purchase',jsonb_build_object(
    'installmentId',v_old,'amount',50,'discountAmount',20,'paymentMethod','dinheiro',
    'items',jsonb_build_array(jsonb_build_object('product_variant_id',v_variant,'quantity',1)),
    'purchasePaymentMethod','parcelado','purchaseDownPayment',0,'purchaseInstallmentsCount',2,
    'purchaseFirstDueDate','2099-02-01'));
  v_new_sale := (v_result->>'resultId')::uuid;
  if v_new_sale is null or (select total from public.sales where id=v_new_sale) <> 480
    or (select sum(amount-paid_amount) from public.installments where sale_id=v_new_sale) <> 480
    or (select stock_quantity from public.product_variants where id=v_variant) <> 9
    or (select sum(amount) from public.payments where installment_id in(v_old,v_selected)) <> 260
    or (select sum(amount) from public.customer_discounts where customer_id=v_customer) <> 80
    or (select sum(amount) from public.cash_movements where reference_id in(v_old,v_selected) and type='entrada') <> 260 then
    raise exception 'Receber + vender com desconto alterou caixa, estoque ou dívida nova';
  end if;

  perform public.reverse_customer_discount(v_customer,v_operation);
  if (select amount-paid_amount from public.installments where id=v_selected) <> 40 then
    raise exception 'Desconto do recebimento não pode ser estornado na ficha';
  end if;
  if v_collector is not null then
    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_collector,'role','authenticated')::text,true);
    v_denied:=false;
    begin
      perform public.process_offline_operation(gen_random_uuid(),'payment',jsonb_build_object(
        'installmentId',v_selected,'amount',20,'discountAmount',20,'paymentMethod','pix'));
    exception when others then
      if sqlerrm like '%proprietário%' then v_denied:=true; else raise; end if;
    end;
    if not v_denied then raise exception 'Colaborador concedeu desconto'; end if;
  end if;
  execute 'set local role postgres';
end;
$test$;
rollback;
select 'PASS: desconto na parcela selecionada, pagamento parcial e total, caixa, idempotência, rollback, nova compra, estorno e permissões; dados de teste revertidos' as result;
