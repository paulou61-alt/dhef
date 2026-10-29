-- Excluir um recebimento lançado por engano (só o proprietário).
-- Devolve o valor para a parcela (que volta a ficar em aberto), lança o
-- estorno no caixa e reabre a venda se ela estava marcada como paga.
-- A ficha do cliente volta a ficar ativa sozinha (gatilho das parcelas).
-- Pode ser executada mais de uma vez com segurança.

create or replace function public.delete_payment(p_payment_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_payment public.payments%rowtype;
  v_installment public.installments%rowtype;
  v_new_paid numeric(12,2);
  v_new_status public.installment_status;
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if v_user_id is null then raise exception 'Usuário não autenticado'; end if;
  if private.current_access_role() <> 'owner' then
    raise exception 'Apenas o proprietário pode excluir recebimentos';
  end if;

  select * into v_payment
  from public.payments
  where id = p_payment_id and user_id = v_user_id
  for update;
  if v_payment.id is null then raise exception 'Recebimento não encontrado'; end if;

  select * into v_installment
  from public.installments
  where id = v_payment.installment_id and user_id = v_user_id
  for update;
  if v_installment.id is null then raise exception 'Parcela não encontrada'; end if;

  v_new_paid := greatest(round(coalesce(v_installment.paid_amount, 0) - coalesce(v_payment.amount, 0), 2), 0);

  if v_new_paid >= v_installment.amount then
    v_new_status := 'pago';
  elsif v_installment.due_date < v_today then
    v_new_status := 'vencido';
  elsif v_new_paid > 0 then
    v_new_status := 'parcial';
  else
    v_new_status := 'pendente';
  end if;

  delete from public.payments where id = v_payment.id and user_id = v_user_id;

  update public.installments
  set paid_amount = v_new_paid, status = v_new_status
  where id = v_installment.id and user_id = v_user_id;

  if v_new_status <> 'pago' then
    update public.sales set is_paid = false
    where id = v_installment.sale_id and user_id = v_user_id and is_paid;
  end if;

  insert into public.cash_movements (user_id, type, origin, amount, description, reference_id)
  values (
    v_user_id, 'saida', 'manual', v_payment.amount,
    'Estorno de recebimento excluído parcela ' || v_installment.installment_number || '/' || v_installment.total_installments,
    v_installment.id
  );
end;
$function$;

revoke all on function public.delete_payment(uuid) from public, anon;
grant execute on function public.delete_payment(uuid) to authenticated;
