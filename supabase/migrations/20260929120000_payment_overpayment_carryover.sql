-- =====================================================================
-- Pagamento a mais: o excedente é abatido automaticamente nas próximas
-- parcelas em aberto.
--
-- A função register_payment original é renomeada para
-- register_payment_single (sem alterar o seu conteúdo) e passa a ser
-- chamada uma vez para cada parcela atingida. Assim todas as validações
-- de acesso, o registro em payments e o lançamento no caixa continuam
-- exatamente como antes. Como tudo roda em uma única transação, se algo
-- falhar nenhum recebimento é gravado.
--
-- Ordem do abatimento:
--   1. parcelas seguintes da mesma venda;
--   2. demais pendências do mesmo cliente, pelo vencimento.
-- Se o valor for maior que tudo o que o cliente deve, o pagamento é
-- recusado.
--
-- Pode ser executada mais de uma vez com segurança.
-- =====================================================================

do $$
begin
  if to_regprocedure('public.register_payment_single(uuid, numeric, public.sale_payment_method, date, text)') is null then
    alter function public.register_payment(uuid, numeric, public.sale_payment_method, date, text)
      rename to register_payment_single;
  end if;
end;
$$;

create or replace function public.register_payment(
  p_installment_id uuid,
  p_amount numeric,
  p_payment_method public.sale_payment_method,
  p_payment_date date default current_date,
  p_notes text default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_target public.installments%rowtype;
  v_customer_id uuid;
  v_remaining numeric(12,2);
  v_open numeric(12,2);
  v_chunk numeric(12,2);
  v_note text;
  v_next record;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Valor de pagamento inválido';
  end if;

  select *
    into v_target
  from public.installments
  where id = p_installment_id
  for update;

  v_open := greatest(coalesce(v_target.amount, 0) - coalesce(v_target.paid_amount, 0), 0);

  -- Parcela não encontrada ou valor dentro do saldo: comportamento original.
  if v_target.id is null or round(p_amount, 2) <= v_open then
    perform public.register_payment_single(p_installment_id, p_amount, p_payment_method, p_payment_date, p_notes);
    return;
  end if;

  v_remaining := round(p_amount, 2);

  if v_open > 0 then
    perform public.register_payment_single(p_installment_id, v_open, p_payment_method, p_payment_date, p_notes);
    v_remaining := v_remaining - v_open;
  end if;

  select s.customer_id
    into v_customer_id
  from public.sales s
  where s.id = v_target.sale_id;

  v_note := 'Excedente do pagamento da parcela '
    || v_target.installment_number || '/' || v_target.total_installments
    || coalesce(' · ' || nullif(trim(p_notes), ''), '');

  for v_next in
    select i.id, i.amount - i.paid_amount as open_amount
    from public.installments i
    join public.sales s on s.id = i.sale_id
    where i.id <> v_target.id
      and i.user_id = v_target.user_id
      and i.status in ('pendente', 'parcial', 'vencido')
      and i.amount - i.paid_amount > 0
      and s.status <> 'cancelled'
      and (
        i.sale_id = v_target.sale_id
        or (v_customer_id is not null and s.customer_id = v_customer_id)
      )
    order by
      (i.sale_id = v_target.sale_id and i.installment_number > v_target.installment_number) desc,
      i.due_date,
      i.installment_number
    for update of i
  loop
    exit when v_remaining <= 0;
    v_chunk := least(v_remaining, v_next.open_amount);
    perform public.register_payment_single(v_next.id, v_chunk, p_payment_method, p_payment_date, v_note);
    v_remaining := v_remaining - v_chunk;
  end loop;

  if v_remaining > 0 then
    raise exception 'Pagamento maior que o saldo total em aberto do cliente (sobram R$ %)', replace(to_char(v_remaining, 'FM999999990.00'), '.', ',');
  end if;
end;
$function$;

revoke all on function public.register_payment(uuid, numeric, public.sale_payment_method, date, text) from public, anon;
grant execute on function public.register_payment(uuid, numeric, public.sale_payment_method, date, text) to authenticated;
