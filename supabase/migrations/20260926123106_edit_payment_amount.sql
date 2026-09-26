create or replace function public.update_payment_amount(
  p_payment_id uuid,
  p_amount numeric
)
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
  v_delta numeric(12,2);
  v_new_status public.installment_status;
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Informe um valor maior que zero';
  end if;

  if private.current_access_role() <> 'owner' then
    raise exception 'Apenas o proprietário pode editar recebimentos';
  end if;

  select *
    into v_payment
  from public.payments
  where id = p_payment_id
    and user_id = v_user_id
  for update;

  if v_payment.id is null then
    raise exception 'Recebimento não encontrado';
  end if;

  select *
    into v_installment
  from public.installments
  where id = v_payment.installment_id
    and user_id = v_user_id
  for update;

  if v_installment.id is null then
    raise exception 'Parcela não encontrada';
  end if;

  v_new_paid := round(
    coalesce(v_installment.paid_amount, 0)
    - coalesce(v_payment.amount, 0)
    + p_amount,
    2
  );

  if v_new_paid < 0 then
    raise exception 'Valor do recebimento inválido';
  end if;

  if v_new_paid > v_installment.amount then
    raise exception 'O novo valor deixa o total pago maior que o valor da parcela';
  end if;

  v_delta := round(p_amount - v_payment.amount, 2);

  update public.payments
  set amount = round(p_amount, 2)
  where id = v_payment.id
    and user_id = v_user_id;

  if v_new_paid >= v_installment.amount then
    v_new_status := 'pago';
  elsif v_new_paid > 0 then
    v_new_status := 'parcial';
  elsif v_installment.due_date < current_date then
    v_new_status := 'vencido';
  else
    v_new_status := 'pendente';
  end if;

  update public.installments
  set
    paid_amount = v_new_paid,
    status = v_new_status
  where id = v_installment.id
    and user_id = v_user_id;

  if v_delta > 0 then
    insert into public.cash_movements (
      user_id, type, origin, amount, description, reference_id
    ) values (
      v_user_id,
      'entrada',
      'manual',
      v_delta,
      'Ajuste de recebimento parcela ' || v_installment.installment_number || '/' || v_installment.total_installments,
      v_installment.id
    );
  elsif v_delta < 0 then
    insert into public.cash_movements (
      user_id, type, origin, amount, description, reference_id
    ) values (
      v_user_id,
      'saida',
      'manual',
      abs(v_delta),
      'Estorno de ajuste de recebimento parcela ' || v_installment.installment_number || '/' || v_installment.total_installments,
      v_installment.id
    );
  end if;
end;
$function$;

revoke all on function public.update_payment_amount(uuid, numeric) from public, anon;
grant execute on function public.update_payment_amount(uuid, numeric) to authenticated;
