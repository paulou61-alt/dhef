-- Integração com dados sintéticos, sempre revertida. Não altera clientes reais.
begin;
do $test$
declare
  v_owner uuid;
  v_customer uuid := gen_random_uuid();
  v_sale uuid := gen_random_uuid();
  v_first uuid := gen_random_uuid();
  v_second uuid := gen_random_uuid();
  v_discount uuid := gen_random_uuid();
  v_final uuid := gen_random_uuid();
  v_ficha integer;
  v_count integer;
  v_denied boolean;
  v_collaborator uuid;
begin
  select c.user_id into v_owner from public.customers c
  where not exists (select 1 from public.collaborators x where x.auth_user_id = c.user_id)
  limit 1;
  if v_owner is null then raise exception 'Sem proprietário para o teste'; end if;
  select n into v_ficha from generate_series(1,1000) n where not exists (
    select 1 from public.customers c where c.user_id = v_owner
    and c.assigned_collaborator_id is null and not c.ficha_released and c.ficha_number = n
  ) limit 1;
  if v_ficha is null then raise exception 'Sem ficha disponível para o teste'; end if;
  insert into public.customers(id,user_id,name,ficha_number,ficha_released)
  values (v_customer,v_owner,'__TESTE_TRANSACIONAL_DESCONTOS__',v_ficha,true);
  insert into public.sales(id,user_id,customer_id,sale_number,status,payment_method,subtotal,total,down_payment,is_paid)
  values(v_sale,v_owner,v_customer,-900000000001,'completed','parcelado',300,300,0,false);
  insert into public.installments(id,user_id,sale_id,installment_number,total_installments,amount,paid_amount,due_date,status)
  values(v_first,v_owner,v_sale,1,2,100,20,'2026-01-01','vencido'),
        (v_second,v_owner,v_sale,2,2,200,0,'2099-01-01','pendente');

  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_owner,'role','authenticated')::text,true);
  execute 'set local role authenticated';
  perform public.apply_customer_discount(v_customer,100,'Acordo de teste',v_discount);
  if (select amount from public.installments where id=v_first) <> 20
     or (select paid_amount from public.installments where id=v_first) <> 20
     or (select status from public.installments where id=v_first) <> 'pago'
     or (select amount from public.installments where id=v_second) <> 180 then
    raise exception 'Falha ao distribuir desconto nas parcelas mais antigas';
  end if;
  if (select sum(amount-paid_amount) from public.installments where sale_id=v_sale) <> 180 then
    raise exception 'Saldo após desconto incorreto';
  end if;
  perform public.apply_customer_discount(v_customer,100,'Acordo de teste',v_discount);
  if (select count(*) from public.customer_discounts where customer_id=v_customer) <> 1 then
    raise exception 'Retentativa duplicou desconto';
  end if;
  if (select sum(amount-paid_amount) from public.installments where sale_id=v_sale) <> 180 then
    raise exception 'Retentativa abateu saldo duas vezes';
  end if;
  v_denied := false;
  begin
    perform public.apply_customer_discount(v_customer,180.01,null,gen_random_uuid());
  exception when others then
    if sqlerrm like '%saldo em aberto%' then v_denied := true; else raise; end if;
  end;
  if not v_denied then raise exception 'Aceitou desconto acima do saldo'; end if;
  v_denied := false;
  begin
    perform public.apply_customer_discount(v_customer,0.001,null,gen_random_uuid());
  exception when others then
    if sqlerrm like '%duas casas%' then v_denied := true; else raise; end if;
  end;
  if not v_denied then raise exception 'Aceitou fração de centavo'; end if;

  perform public.apply_customer_discount(v_customer,180,null,v_final);
  if exists(select 1 from public.installments where sale_id=v_sale and status <> 'pago')
    or not (select ficha_released from public.customers where id=v_customer) then
    raise exception 'Desconto integral não quitou e liberou a ficha';
  end if;
  -- Estorno devolve o valor à dívida e volta a ocupar a ficha.
  perform public.reverse_customer_discount(v_customer,v_final);
  perform public.reverse_customer_discount(v_customer,v_final);
  if (select amount from public.installments where id=v_second) <> 180
    or (select ficha_released from public.customers where id=v_customer) then
    raise exception 'Estorno incorreto ou duplicado';
  end if;
  -- Recebimento real após desconto registra apenas o dinheiro recebido.
  perform public.register_payment(v_second,180,'pix',current_date,'Teste transacional');
  if (select sum(amount) from public.payments where installment_id in (v_first,v_second)) <> 180
    or (select sum(amount) from public.cash_movements where reference_id in (v_first,v_second) and type='entrada') <> 180
    or (select total from public.sales where id=v_sale) <> 300 then
    raise exception 'Desconto alterou caixa, pagamento ou venda';
  end if;
  perform public.reverse_customer_discount(v_customer,v_discount);
  if (select sum(amount-paid_amount) from public.installments where sale_id=v_sale) <> 100 then
    raise exception 'Estorno após pagamento não preservou saldo';
  end if;
  if (select count(*) from public.customer_discounts where customer_id=v_customer and reversed_at is not null) <> 2 then
    raise exception 'Histórico não preservou estornos';
  end if;

  -- Outro usuário autenticado não lê nem modifica os dados do proprietário.
  perform set_config('request.jwt.claims',jsonb_build_object('sub',gen_random_uuid(),'role','authenticated')::text,true);
  if exists(select 1 from public.customer_discounts where customer_id=v_customer) then raise exception 'RLS expôs desconto de outro proprietário'; end if;
  v_denied := false;
  begin
    perform public.apply_customer_discount(v_customer,1,null,gen_random_uuid());
  exception when others then
    if sqlerrm like '%Cliente não encontrado%' then v_denied := true; else raise; end if;
  end;
  if not v_denied then raise exception 'Outro usuário concedeu desconto'; end if;
  if has_function_privilege('anon','public.apply_customer_discount(uuid,numeric,text,uuid)','execute')
    or has_function_privilege('anon','public.reverse_customer_discount(uuid,uuid)','execute') then
    raise exception 'Função exposta para anônimo';
  end if;
  execute 'set local role postgres';
  select auth_user_id into v_collaborator from public.collaborators where auth_user_id is not null limit 1;
  if v_collaborator is not null then
    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_collaborator,'role','authenticated')::text,true);
    execute 'set local role authenticated';
    v_denied := false;
    begin
      perform public.apply_customer_discount(v_customer,1,null,gen_random_uuid());
    exception when others then
      if sqlerrm like '%proprietário%' then v_denied := true; else raise; end if;
    end;
    if not v_denied then raise exception 'Colaborador concedeu desconto'; end if;
    execute 'set local role postgres';
  end if;
end;
$test$;
rollback;
select 'PASS: abatimento parcial e integral, centavos, idempotência, estorno, pagamento real, caixa e controle de acesso; dados de teste revertidos' as result;
