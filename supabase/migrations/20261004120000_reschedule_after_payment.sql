-- =====================================================================
-- Escolher o vencimento do saldo depois de um recebimento.
--
-- Quando o cliente paga a menos, o restante continua na mesma parcela;
-- quando paga a mais, o excedente abate as próximas. Em ambos os casos,
-- esta função muda o vencimento da parcela que ficou com saldo em aberto:
--   1. a própria parcela recebida, se ainda sobrou saldo nela;
--   2. senão, a próxima em aberto (mesma ordem do abatimento do excedente).
-- Devolve o id da parcela alterada, ou null se o cliente não deve mais nada.
--
-- Pode ser executada mais de uma vez com segurança.
-- =====================================================================

create or replace function public.reschedule_open_installment(
  p_installment_id uuid,
  p_due_date date
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_owner_id uuid := private.current_owner_id();
  v_role text := private.current_access_role();
  v_collector_id uuid := private.current_collaborator_id();
  v_target public.installments%rowtype;
  v_customer_id uuid;
  v_chosen public.installments%rowtype;
begin
  if auth.uid() is null or v_owner_id is null then raise exception 'Usuário não autenticado'; end if;
  if v_role not in ('owner', 'cobrador') then raise exception 'Sem permissão para alterar vencimentos'; end if;
  if p_due_date is null then raise exception 'Informe a data de vencimento'; end if;

  select * into v_target from public.installments where id = p_installment_id and user_id = v_owner_id;
  if v_target.id is null then raise exception 'Parcela não encontrada'; end if;

  select s.customer_id into v_customer_id from public.sales s where s.id = v_target.sale_id;

  if v_role = 'cobrador' and not exists (
    select 1 from public.customers c
    where c.id = v_customer_id and c.assigned_collaborator_id = v_collector_id
  ) then
    raise exception 'Este cliente não pertence à carteira deste cobrador';
  end if;

  if v_target.status <> 'pago' and v_target.amount - v_target.paid_amount > 0 then
    v_chosen := v_target;
  else
    select i.* into v_chosen
    from public.installments i
    join public.sales s on s.id = i.sale_id
    where i.id <> v_target.id
      and i.user_id = v_owner_id
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
    limit 1;
  end if;

  if v_chosen.id is null then return null; end if;

  update public.installments
  set due_date = p_due_date,
      status = case
        when p_due_date < current_date then 'vencido'::public.installment_status
        when paid_amount > 0 then 'parcial'::public.installment_status
        else 'pendente'::public.installment_status
      end
  where id = v_chosen.id;

  return v_chosen.id;
end;
$function$;

revoke all on function public.reschedule_open_installment(uuid, date) from public, anon;
grant execute on function public.reschedule_open_installment(uuid, date) to authenticated;
