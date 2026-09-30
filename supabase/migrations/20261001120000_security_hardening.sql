-- =====================================================================
-- Reforços de segurança (resultado da auditoria de 01/10/2026).
-- Pode ser executada mais de uma vez com segurança.
-- =====================================================================

-- 1. Cobrador só pode registrar recebimento de clientes da própria carteira.
--    Antes, bastava o cobrador saber o ID de uma parcela de outro cobrador
--    da mesma empresa. O restante da função está igual ao original.
create or replace function private.register_payment_impl(
  p_installment_id uuid,
  p_amount numeric,
  p_payment_method sale_payment_method,
  p_payment_date date default current_date,
  p_notes text default null::text
)
returns void
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_owner_id uuid := private.current_owner_id();
  v_role text := private.current_access_role();
  v_collector_id uuid := private.current_collaborator_id();
  v_installment record;
  v_new_paid numeric(12,2);
  v_new_status public.installment_status;
begin
  if auth.uid() is null or v_owner_id is null then raise exception 'Usuário não autenticado'; end if;
  if v_role not in ('owner','cobrador') then raise exception 'Sem permissão para registrar recebimentos'; end if;
  select * into v_installment from public.installments where id = p_installment_id and user_id = v_owner_id for update;
  if v_installment is null then raise exception 'Parcela não encontrada'; end if;

  if v_role = 'cobrador' and not exists (
    select 1
    from public.sales s
    join public.customers c on c.id = s.customer_id
    where s.id = v_installment.sale_id
      and c.assigned_collaborator_id = v_collector_id
  ) then
    raise exception 'Este cliente não pertence à carteira deste cobrador';
  end if;

  if p_amount is null or p_amount <= 0 then raise exception 'Valor de pagamento inválido'; end if;
  if p_amount > (v_installment.amount - v_installment.paid_amount) then raise exception 'Pagamento maior que o saldo da parcela'; end if;

  insert into public.payments (user_id, installment_id, amount, payment_method, payment_date, notes, collected_by_collaborator_id)
  values (v_owner_id, p_installment_id, p_amount, p_payment_method, p_payment_date, p_notes,
    case when v_role = 'cobrador' then v_collector_id else null end);

  v_new_paid := v_installment.paid_amount + p_amount;
  if v_new_paid >= v_installment.amount then v_new_status := 'pago';
  elsif v_new_paid > 0 then v_new_status := 'parcial';
  else v_new_status := 'pendente'; end if;

  update public.installments set paid_amount = v_new_paid, status = v_new_status where id = p_installment_id;
  insert into public.cash_movements (user_id, type, origin, amount, description, reference_id)
  values (v_owner_id, 'entrada', 'recebimento', p_amount,
    'Recebimento parcela ' || v_installment.installment_number || '/' || v_installment.total_installments,
    p_installment_id);

  if not exists (
    select 1 from public.installments i
    where i.sale_id = v_installment.sale_id and i.status <> 'pago'
  ) then
    update public.sales set is_paid = true where id = v_installment.sale_id and user_id = v_owner_id;
  end if;
end;
$function$;

-- 2. Visitantes sem login (anon) não precisam executar estas funções.
--    Elas já recusavam quem não está logado; aqui a porta fica fechada de vez.
revoke execute on function public.create_customer_opening_balance(uuid, numeric, date) from public, anon;
grant execute on function public.create_customer_opening_balance(uuid, numeric, date) to authenticated;

revoke execute on function public.initialize_customer_account(uuid, numeric, jsonb, public.sale_payment_method, numeric, integer, date, text) from public, anon;
grant execute on function public.initialize_customer_account(uuid, numeric, jsonb, public.sale_payment_method, numeric, integer, date, text) to authenticated;

revoke execute on function public.process_offline_operation(uuid, text, jsonb) from public, anon;
grant execute on function public.process_offline_operation(uuid, text, jsonb) to authenticated;

revoke execute on function public.register_payment_with_purchase(uuid, numeric, public.sale_payment_method, date, text, jsonb, public.sale_payment_method, numeric, integer, date, text) from public, anon;
grant execute on function public.register_payment_with_purchase(uuid, numeric, public.sale_payment_method, date, text, jsonb, public.sale_payment_method, numeric, integer, date, text) to authenticated;

-- 3. Permissões desnecessárias na tabela de controle do modo offline.
revoke truncate, references, trigger on table public.offline_sync_receipts from authenticated;

-- 4. Garante que a view de saldos respeite as regras de acesso de quem consulta.
alter view public.v_customer_balance set (security_invoker = true);
