-- Abatimentos da dívida não são pagamentos: reduzem o valor exigível das
-- parcelas e preservam pagamentos, vendas e caixa. O histórico guarda cada
-- alocação para permitir estorno, sem apagar o lançamento original.
create table public.customer_discounts (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  note text check (char_length(note) <= 240),
  created_at timestamptz not null default now(),
  reversed_at timestamptz
);
create index customer_discounts_customer_idx on public.customer_discounts(customer_id, created_at desc);
create index customer_discounts_user_idx on public.customer_discounts(user_id);

create table public.customer_discount_items (
  discount_id uuid not null references public.customer_discounts(id) on delete cascade,
  installment_id uuid not null references public.installments(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  primary key (discount_id, installment_id)
);
create index customer_discount_items_installment_idx on public.customer_discount_items(installment_id);

alter table public.customer_discounts enable row level security;
alter table public.customer_discount_items enable row level security;
revoke all on public.customer_discounts, public.customer_discount_items from public, anon, authenticated;
grant select, insert, update on public.customer_discounts to authenticated;
grant select, insert on public.customer_discount_items to authenticated;

create policy discounts_select on public.customer_discounts for select to authenticated
using (user_id = (select private.current_owner_id()) and exists (
  select 1 from public.customers c where c.id = customer_id and c.user_id = customer_discounts.user_id
));
create policy discounts_insert_owner on public.customer_discounts for insert to authenticated
with check (user_id = (select auth.uid()) and (select private.current_access_role()) = 'owner'
  and exists (select 1 from public.customers c where c.id = customer_id and c.user_id = (select auth.uid())));
create policy discounts_update_owner on public.customer_discounts for update to authenticated
using (user_id = (select auth.uid()) and (select private.current_access_role()) = 'owner')
with check (user_id = (select auth.uid()) and (select private.current_access_role()) = 'owner'
  and exists (select 1 from public.customers c where c.id = customer_id and c.user_id = (select auth.uid())));
create policy discount_items_select on public.customer_discount_items for select to authenticated
using (exists (select 1 from public.customer_discounts d where d.id = discount_id));
create policy discount_items_insert_owner on public.customer_discount_items for insert to authenticated
with check ((select private.current_access_role()) = 'owner' and exists (
  select 1 from public.customer_discounts d
  join public.installments i on i.id = installment_id
  join public.sales s on s.id = i.sale_id
  where d.id = discount_id and d.user_id = (select auth.uid())
    and i.user_id = d.user_id and s.customer_id = d.customer_id and s.user_id = d.user_id
));

-- SECURITY INVOKER: mantém as políticas de proprietário em todas as escritas.
-- A ordem dos bloqueios acompanha recebimentos (parcelas antes do cliente).
create function public.apply_customer_discount(
  p_customer_id uuid, p_amount numeric, p_note text, p_request_id uuid
) returns uuid language plpgsql security invoker set search_path = '' as $function$
declare
  v_uid uuid := auth.uid();
  v_previous public.customer_discounts%rowtype;
  v_open numeric(12,2);
  v_remaining numeric(12,2);
  v_chunk numeric(12,2);
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_item record;
begin
  if v_uid is null or private.current_access_role() <> 'owner' then
    raise exception 'Apenas o proprietário pode conceder descontos';
  end if;
  if p_amount is null or p_amount::text in ('NaN','Infinity','-Infinity')
    or p_amount <= 0 or p_amount > 9999999999.99 or round(p_amount, 2) <> p_amount then
    raise exception 'Informe um desconto maior que zero, com até duas casas decimais';
  end if;
  if p_request_id is null then raise exception 'Identificador de lançamento inválido'; end if;

  -- Bloqueia inclusive as parcelas já pagas, para coordenar estornos.
  perform i.id from public.installments i join public.sales s on s.id = i.sale_id
  where s.customer_id = p_customer_id and s.user_id = v_uid and i.user_id = v_uid
    and s.status = 'completed'
  order by i.id for update of i;
  perform c.id from public.customers c where c.id = p_customer_id and c.user_id = v_uid for update;
  if not found then raise exception 'Cliente não encontrado'; end if;

  -- Retentativas do mesmo envio nunca concedem o desconto duas vezes.
  select * into v_previous from public.customer_discounts where id = p_request_id;
  if found then
    if v_previous.customer_id <> p_customer_id or v_previous.user_id <> v_uid
      or v_previous.amount <> p_amount
      or v_previous.note is distinct from nullif(btrim(left(p_note, 240)), '') then
      raise exception 'Identificador de lançamento já utilizado';
    end if;
    return v_previous.id;
  end if;

  select coalesce(sum(greatest(i.amount - i.paid_amount, 0)), 0) into v_open
  from public.installments i join public.sales s on s.id = i.sale_id
  where s.customer_id = p_customer_id and s.user_id = v_uid and i.user_id = v_uid
    and s.status = 'completed' and i.status <> 'pago';
  if p_amount > v_open then raise exception 'O desconto não pode ser maior que o saldo em aberto'; end if;

  insert into public.customer_discounts(id, user_id, customer_id, amount, note)
  values (p_request_id, v_uid, p_customer_id, p_amount, nullif(btrim(left(p_note, 240)), ''));
  v_remaining := p_amount;
  for v_item in
    select i.* from public.installments i join public.sales s on s.id = i.sale_id
    where s.customer_id = p_customer_id and s.user_id = v_uid and i.user_id = v_uid
      and s.status = 'completed' and i.status <> 'pago' and i.amount > i.paid_amount
    order by i.due_date, i.installment_number, i.id
  loop
    exit when v_remaining = 0;
    v_chunk := least(v_remaining, v_item.amount - v_item.paid_amount);
    insert into public.customer_discount_items(discount_id, installment_id, amount)
    values (p_request_id, v_item.id, v_chunk);
    update public.installments set amount = amount - v_chunk,
      status = case
        when amount - v_chunk <= paid_amount then 'pago'::public.installment_status
        when due_date < v_today then 'vencido'::public.installment_status
        when paid_amount > 0 then 'parcial'::public.installment_status
        else 'pendente'::public.installment_status end
    where id = v_item.id and user_id = v_uid;
    v_remaining := v_remaining - v_chunk;
  end loop;
  if v_remaining <> 0 then raise exception 'O saldo foi alterado. Tente novamente'; end if;
  -- Não altera sales.total/is_paid: a venda original e o dinheiro recebido
  -- continuam preservados. O status das parcelas determina a quitação.
  return p_request_id;
end;
$function$;

create function public.reverse_customer_discount(p_customer_id uuid, p_discount_id uuid)
returns void language plpgsql security invoker set search_path = '' as $function$
declare
  v_uid uuid := auth.uid();
  v_discount public.customer_discounts%rowtype;
  v_allocated numeric(12,2);
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_item record;
begin
  if v_uid is null or private.current_access_role() <> 'owner' then
    raise exception 'Apenas o proprietário pode estornar descontos';
  end if;
  perform i.id from public.installments i join public.sales s on s.id = i.sale_id
  where s.customer_id = p_customer_id and s.user_id = v_uid and i.user_id = v_uid
    and s.status = 'completed'
  order by i.id for update of i;
  perform c.id from public.customers c where c.id = p_customer_id and c.user_id = v_uid for update;
  if not found then raise exception 'Cliente não encontrado'; end if;
  select * into v_discount from public.customer_discounts
  where id = p_discount_id and customer_id = p_customer_id and user_id = v_uid for update;
  if not found then raise exception 'Desconto não encontrado'; end if;
  if v_discount.reversed_at is not null then return; end if;

  select coalesce(sum(d.amount), 0) into v_allocated from public.customer_discount_items d
  join public.installments i on i.id = d.installment_id
  join public.sales s on s.id = i.sale_id
  where d.discount_id = p_discount_id and i.user_id = v_uid and s.user_id = v_uid
    and s.customer_id = p_customer_id and s.status = 'completed';
  if v_allocated <> v_discount.amount then
    raise exception 'As parcelas foram alteradas ou excluídas. Não foi possível estornar o desconto';
  end if;

  for v_item in select * from public.customer_discount_items where discount_id = p_discount_id
  loop
    update public.installments set amount = amount + v_item.amount,
      status = case
        when due_date < v_today then 'vencido'::public.installment_status
        when paid_amount > 0 then 'parcial'::public.installment_status
        else 'pendente'::public.installment_status end
    where id = v_item.installment_id and user_id = v_uid;
    update public.sales set is_paid = false where id = (
      select sale_id from public.installments where id = v_item.installment_id
    ) and user_id = v_uid;
  end loop;
  update public.customer_discounts set reversed_at = now() where id = p_discount_id and user_id = v_uid;
  -- O gatilho existente recalcula a liberação da ficha. Se seu número foi
  -- reutilizado, a operação falha e o desconto permanece válido.
end;
$function$;
revoke all on function public.apply_customer_discount(uuid,numeric,text,uuid) from public, anon;
revoke all on function public.reverse_customer_discount(uuid,uuid) from public, anon;
grant execute on function public.apply_customer_discount(uuid,numeric,text,uuid) to authenticated;
grant execute on function public.reverse_customer_discount(uuid,uuid) to authenticated;
