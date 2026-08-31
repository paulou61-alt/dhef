-- =====================================================================
-- SISTEMA DE CONTROLE DE VENDAS - SCHEMA INICIAL
-- Execute este script inteiro no SQL Editor do Supabase (Dashboard > SQL Editor)
-- =====================================================================

-- ---------------------------------------------------------------------
-- EXTENSÕES
-- ---------------------------------------------------------------------
create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------
create type sale_status as enum ('completed', 'pending', 'cancelled');
create type sale_payment_method as enum ('pix', 'dinheiro', 'cartao', 'fiado', 'parcelado');
create type installment_status as enum ('pendente', 'pago', 'vencido', 'parcial');
create type movement_type as enum ('entrada', 'saida', 'ajuste', 'venda', 'devolucao');
create type cash_movement_type as enum ('entrada', 'saida');
create type cash_movement_origin as enum ('venda', 'recebimento', 'despesa', 'manual');

-- ---------------------------------------------------------------------
-- FUNÇÃO AUXILIAR: updated_at automático
-- ---------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- =====================================================================
-- TABELA: profiles
-- Estende auth.users. Criada automaticamente via trigger no signup.
-- =====================================================================
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  business_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "profiles_select_own" on profiles for select to authenticated using (id = (select auth.uid()));
create policy "profiles_update_own" on profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "profiles_insert_own" on profiles for insert to authenticated with check (id = (select auth.uid()));

create trigger trg_profiles_updated_at before update on profiles
  for each row execute function set_updated_at();

-- cria profile automaticamente quando um usuário se cadastra
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- =====================================================================
-- TABELA: customers (clientes)
-- =====================================================================
create table customers (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  phone text,
  whatsapp text,
  cpf text,
  address text,
  neighborhood text,
  city text,
  state text,
  zip_code text,
  credit_limit numeric(12,2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_customers_user_id on customers(user_id);
create index idx_customers_name on customers using gin (to_tsvector('portuguese', name));

alter table customers enable row level security;
create policy "customers_all_own" on customers for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create trigger trg_customers_updated_at before update on customers
  for each row execute function set_updated_at();

-- =====================================================================
-- TABELA: products (produtos)
-- =====================================================================
create table products (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  category text,
  brand text,
  sku text,
  cost_price numeric(12,2) not null default 0,
  sale_price numeric(12,2) not null default 0,
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_products_user_id on products(user_id);
create index idx_products_name on products using gin (to_tsvector('portuguese', name));
create index idx_products_active on products(user_id, is_active);

alter table products enable row level security;
create policy "products_all_own" on products for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create trigger trg_products_updated_at before update on products
  for each row execute function set_updated_at();

-- =====================================================================
-- TABELA: product_variants (variações: cor, tamanho, etc + estoque próprio)
-- =====================================================================
create table product_variants (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  variant_name text not null,       -- ex: "Preto / 39"
  attributes jsonb not null default '{}', -- ex: {"cor":"Preto","tamanho":"39"}
  sku text,
  stock_quantity integer not null default 0,
  min_stock integer not null default 0,
  cost_price numeric(12,2),          -- se null, herda do produto
  sale_price numeric(12,2),          -- se null, herda do produto
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stock_non_negative check (stock_quantity >= 0)
);

create index idx_variants_user_id on product_variants(user_id);
create index idx_variants_product_id on product_variants(product_id);
create index idx_variants_low_stock on product_variants(user_id, stock_quantity, min_stock);

alter table product_variants enable row level security;
create policy "variants_all_own" on product_variants for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create trigger trg_variants_updated_at before update on product_variants
  for each row execute function set_updated_at();

-- =====================================================================
-- TABELA: inventory_movements (histórico de movimentações de estoque)
-- =====================================================================
create table inventory_movements (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_variant_id uuid not null references product_variants(id) on delete cascade,
  type movement_type not null,
  quantity integer not null,          -- positivo ou negativo dependendo do tipo
  reason text,
  sale_id uuid,                       -- preenchido se originado de venda (FK adicionada depois)
  created_at timestamptz not null default now()
);

create index idx_inv_mov_user_id on inventory_movements(user_id);
create index idx_inv_mov_variant on inventory_movements(product_variant_id);

alter table inventory_movements enable row level security;
create policy "inv_mov_all_own" on inventory_movements for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- =====================================================================
-- TABELA: sales (vendas)
-- =====================================================================
create table sales (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid references customers(id) on delete set null,  -- null = venda avulsa
  sale_number bigint not null,
  status sale_status not null default 'completed',
  payment_method sale_payment_method not null,
  subtotal numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  down_payment numeric(12,2) not null default 0,   -- entrada
  is_paid boolean not null default false,           -- true = já quitada 100%
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_sales_user_id on sales(user_id);
create index idx_sales_customer_id on sales(customer_id);
create index idx_sales_created_at on sales(user_id, created_at desc);
create unique index idx_sales_number_per_user on sales(user_id, sale_number);

alter table sales enable row level security;
create policy "sales_all_own" on sales for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create trigger trg_sales_updated_at before update on sales
  for each row execute function set_updated_at();

alter table inventory_movements
  add constraint fk_inv_mov_sale foreign key (sale_id) references sales(id) on delete set null;

-- sequência de numeração de venda por usuário
create sequence if not exists sale_number_seq;

-- =====================================================================
-- TABELA: sale_items (itens da venda)
-- Guarda snapshot do custo e preço no momento da venda (histórico protegido)
-- =====================================================================
create table sale_items (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sale_id uuid not null references sales(id) on delete cascade,
  product_variant_id uuid not null references product_variants(id),
  product_name_snapshot text not null,
  variant_name_snapshot text,
  quantity integer not null check (quantity > 0),
  unit_cost_snapshot numeric(12,2) not null,   -- custo no momento da venda (NUNCA recalcular)
  unit_price_snapshot numeric(12,2) not null,  -- preço de venda no momento
  subtotal numeric(12,2) not null,
  created_at timestamptz not null default now()
);

create index idx_sale_items_user_id on sale_items(user_id);
create index idx_sale_items_sale_id on sale_items(sale_id);

alter table sale_items enable row level security;
create policy "sale_items_all_own" on sale_items for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- =====================================================================
-- TABELA: installments (parcelas / fiado)
-- =====================================================================
create table installments (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sale_id uuid not null references sales(id) on delete cascade,
  installment_number integer not null,   -- 1, 2, 3...
  total_installments integer not null,
  amount numeric(12,2) not null,
  paid_amount numeric(12,2) not null default 0,
  due_date date not null,
  status installment_status not null default 'pendente',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_installments_user_id on installments(user_id);
create index idx_installments_sale_id on installments(sale_id);
create index idx_installments_due_date on installments(user_id, due_date, status);

alter table installments enable row level security;
create policy "installments_all_own" on installments for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create trigger trg_installments_updated_at before update on installments
  for each row execute function set_updated_at();

-- =====================================================================
-- TABELA: payments (recebimentos/pagamentos de parcelas)
-- =====================================================================
create table payments (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  installment_id uuid not null references installments(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  payment_method sale_payment_method not null,
  payment_date date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);

create index idx_payments_user_id on payments(user_id);
create index idx_payments_installment_id on payments(installment_id);

alter table payments enable row level security;
create policy "payments_all_own" on payments for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- =====================================================================
-- TABELA: expenses (despesas)
-- =====================================================================
create table expenses (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null,
  category text not null default 'outros',
  amount numeric(12,2) not null check (amount > 0),
  expense_date date not null default current_date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_expenses_user_id on expenses(user_id);
create index idx_expenses_date on expenses(user_id, expense_date desc);

alter table expenses enable row level security;
create policy "expenses_all_own" on expenses for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create trigger trg_expenses_updated_at before update on expenses
  for each row execute function set_updated_at();

-- =====================================================================
-- TABELA: cash_movements (caixa)
-- =====================================================================
create table cash_movements (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type cash_movement_type not null,
  origin cash_movement_origin not null,
  amount numeric(12,2) not null check (amount > 0),
  description text,
  reference_id uuid,     -- id da venda, pagamento ou despesa que originou
  created_at timestamptz not null default now()
);

create index idx_cash_mov_user_id on cash_movements(user_id);
create index idx_cash_mov_created_at on cash_movements(user_id, created_at desc);

alter table cash_movements enable row level security;
create policy "cash_mov_all_own" on cash_movements for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- =====================================================================
-- FUNÇÃO RPC: create_sale
-- Cria venda + itens + baixa de estoque + parcelas + caixa, tudo atômico.
-- payload de items: [{ "product_variant_id": "...", "quantity": 2 }, ...]
-- =====================================================================
create or replace function create_sale(
  p_customer_id uuid,
  p_items jsonb,                     -- [{product_variant_id, quantity}]
  p_payment_method sale_payment_method,
  p_down_payment numeric default 0,
  p_installments_count integer default 1,
  p_first_due_date date default current_date,
  p_notes text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_sale_id uuid;
  v_sale_number bigint;
  v_item jsonb;
  v_variant record;
  v_qty integer;
  v_subtotal numeric(12,2) := 0;
  v_item_subtotal numeric(12,2);
  v_remaining numeric(12,2);
  v_installment_amount numeric(12,2);
  v_i integer;
  v_due_date date;
  v_is_paid boolean := false;
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'A venda precisa ter ao menos um item';
  end if;

  if coalesce(p_down_payment, 0) < 0 then
    raise exception 'Entrada inválida';
  end if;

  if p_payment_method = 'parcelado' and coalesce(p_installments_count, 0) < 1 then
    raise exception 'Quantidade de parcelas inválida';
  end if;

  if p_customer_id is not null and not exists (
    select 1 from customers where id = p_customer_id and user_id = v_user_id
  ) then
    raise exception 'Cliente não encontrado';
  end if;

  v_sale_number := nextval('sale_number_seq');

  -- calcula subtotal validando estoque
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::integer;

    if v_qty is null or v_qty <= 0 then
      raise exception 'Quantidade inválida';
    end if;

    select pv.*, p.sale_price as product_price into v_variant
      from product_variants pv
      join products p on p.id = pv.product_id
      where pv.id = (v_item->>'product_variant_id')::uuid and pv.user_id = v_user_id
      for update of pv; -- lock para evitar concorrência

    if v_variant is null then
      raise exception 'Variante de produto não encontrada';
    end if;

    if v_variant.stock_quantity < v_qty then
      raise exception 'Estoque insuficiente para %: disponível %, solicitado %',
        v_variant.variant_name, v_variant.stock_quantity, v_qty;
    end if;

    v_subtotal := v_subtotal + (coalesce(v_variant.sale_price, v_variant.product_price) * v_qty);
  end loop;

  if coalesce(p_down_payment, 0) > v_subtotal then
    raise exception 'Entrada não pode ser maior que o total da venda';
  end if;

  -- define se venda já nasce quitada
  if p_payment_method in ('pix', 'dinheiro', 'cartao') then
    v_is_paid := true;
  end if;

  insert into sales (user_id, customer_id, sale_number, status, payment_method,
                      subtotal, total, down_payment, is_paid, notes)
  values (v_user_id, p_customer_id, v_sale_number, 'completed', p_payment_method,
          v_subtotal, v_subtotal, coalesce(p_down_payment, 0), v_is_paid, p_notes)
  returning id into v_sale_id;

  -- itens da venda + baixa de estoque
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::integer;

    select pv.*, p.name as product_name, p.cost_price as product_cost, p.sale_price as product_price
      into v_variant
      from product_variants pv
      join products p on p.id = pv.product_id
      where pv.id = (v_item->>'product_variant_id')::uuid and pv.user_id = v_user_id;

    v_item_subtotal := coalesce(v_variant.sale_price, v_variant.product_price) * v_qty;

    insert into sale_items (user_id, sale_id, product_variant_id, product_name_snapshot,
                             variant_name_snapshot, quantity, unit_cost_snapshot,
                             unit_price_snapshot, subtotal)
    values (v_user_id, v_sale_id, v_variant.id, v_variant.product_name,
            v_variant.variant_name,
            v_qty,
            coalesce(v_variant.cost_price, v_variant.product_cost),
            coalesce(v_variant.sale_price, v_variant.product_price),
            v_item_subtotal);

    update product_variants set stock_quantity = stock_quantity - v_qty
      where id = v_variant.id;

    insert into inventory_movements (user_id, product_variant_id, type, quantity, reason, sale_id)
    values (v_user_id, v_variant.id, 'venda', -v_qty, 'Venda #' || v_sale_number, v_sale_id);
  end loop;

  -- geração de parcelas / fiado
  if p_payment_method = 'fiado' then
    v_remaining := v_subtotal - coalesce(p_down_payment, 0);
    if v_remaining > 0 then
      insert into installments (user_id, sale_id, installment_number, total_installments,
                                 amount, due_date, status)
      values (v_user_id, v_sale_id, 1, 1, v_remaining, p_first_due_date, 'pendente');
    end if;

  elsif p_payment_method = 'parcelado' then
    v_remaining := v_subtotal - coalesce(p_down_payment, 0);
    v_installment_amount := round(v_remaining / p_installments_count, 2);

    for v_i in 1..p_installments_count loop
      v_due_date := p_first_due_date + ((v_i - 1) * interval '1 month');
      insert into installments (user_id, sale_id, installment_number, total_installments,
                                 amount, due_date, status)
      values (
        v_user_id, v_sale_id, v_i, p_installments_count,
        case when v_i = p_installments_count
          then v_remaining - (v_installment_amount * (p_installments_count - 1)) -- ajusta arredondamento na última
          else v_installment_amount
        end,
        v_due_date, 'pendente'
      );
    end loop;
  end if;

  -- registra caixa se for venda à vista quitada
  if v_is_paid then
    insert into cash_movements (user_id, type, origin, amount, description, reference_id)
    values (v_user_id, 'entrada', 'venda', v_subtotal, 'Venda #' || v_sale_number, v_sale_id);
  elsif coalesce(p_down_payment, 0) > 0 then
    insert into cash_movements (user_id, type, origin, amount, description, reference_id)
    values (v_user_id, 'entrada', 'venda', p_down_payment, 'Entrada venda #' || v_sale_number, v_sale_id);
  end if;

  return v_sale_id;
end;
$$;

-- =====================================================================
-- FUNÇÃO RPC: register_payment
-- Registra recebimento de uma parcela (total ou parcial) e atualiza status.
-- =====================================================================
create or replace function register_payment(
  p_installment_id uuid,
  p_amount numeric,
  p_payment_method sale_payment_method,
  p_payment_date date default current_date,
  p_notes text default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_installment record;
  v_new_paid numeric(12,2);
  v_new_status installment_status;
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  select * into v_installment from installments
    where id = p_installment_id and user_id = v_user_id
    for update;

  if v_installment is null then
    raise exception 'Parcela não encontrada';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Valor de pagamento inválido';
  end if;

  if p_amount > (v_installment.amount - v_installment.paid_amount) then
    raise exception 'Pagamento maior que o saldo da parcela';
  end if;

  insert into payments (user_id, installment_id, amount, payment_method, payment_date, notes)
  values (v_user_id, p_installment_id, p_amount, p_payment_method, p_payment_date, p_notes);

  v_new_paid := v_installment.paid_amount + p_amount;

  if v_new_paid >= v_installment.amount then
    v_new_status := 'pago';
  elsif v_new_paid > 0 then
    v_new_status := 'parcial';
  else
    v_new_status := 'pendente';
  end if;

  update installments
    set paid_amount = v_new_paid, status = v_new_status
    where id = p_installment_id;

  insert into cash_movements (user_id, type, origin, amount, description, reference_id)
  values (v_user_id, 'entrada', 'recebimento', p_amount,
          'Recebimento parcela ' || v_installment.installment_number || '/' || v_installment.total_installments,
          p_installment_id);
end;
$$;

-- =====================================================================
-- FUNÇÃO RPC: register_expense
-- Registra despesa e já lança no caixa.
-- =====================================================================
create or replace function register_expense(
  p_description text,
  p_category text,
  p_amount numeric,
  p_expense_date date default current_date,
  p_notes text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_expense_id uuid;
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  insert into expenses (user_id, description, category, amount, expense_date, notes)
  values (v_user_id, p_description, p_category, p_amount, p_expense_date, p_notes)
  returning id into v_expense_id;

  insert into cash_movements (user_id, type, origin, amount, description, reference_id)
  values (v_user_id, 'saida', 'despesa', p_amount, p_description, v_expense_id);

  return v_expense_id;
end;
$$;

-- =====================================================================
-- FUNÇÃO: marcar parcelas vencidas automaticamente (rodar via cron/edge function, opcional)
-- =====================================================================
create or replace function mark_overdue_installments()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update installments
    set status = 'vencido'
    where status in ('pendente', 'parcial')
      and due_date < current_date;
end;
$$;

-- =====================================================================
-- VIEW: dashboard_summary (facilita consultas do dashboard)
-- =====================================================================
create or replace view v_customer_balance
with (security_invoker = true) as
select
  c.id as customer_id,
  c.user_id,
  coalesce(sum(s.total), 0) as total_purchased,
  coalesce(sum(case when i.status = 'pago' then i.paid_amount else 0 end)
    + coalesce(sum(distinct case when s.is_paid then s.total else 0 end), 0), 0) as total_paid,
  coalesce(sum(i.amount - i.paid_amount) filter (where i.status in ('pendente','parcial','vencido')), 0) as total_open
from customers c
left join sales s on s.customer_id = c.id and s.status = 'completed'
left join installments i on i.sale_id = s.id
group by c.id, c.user_id;


-- =====================================================================
-- PERMISSÕES DO DATA API E HARDENING
-- =====================================================================
revoke all on table profiles, customers, products, product_variants, inventory_movements, sales, sale_items, installments, payments, expenses, cash_movements from anon;
grant select, insert, update, delete on table profiles, customers, products, product_variants, inventory_movements, sales, sale_items, installments, payments, expenses, cash_movements to authenticated;

revoke all on sequence sale_number_seq from anon;
grant usage, select, update on sequence sale_number_seq to authenticated;

revoke execute on function set_updated_at() from public, anon, authenticated;
revoke execute on function handle_new_user() from public, anon, authenticated;
revoke execute on function mark_overdue_installments() from public, anon, authenticated;
grant execute on function mark_overdue_installments() to service_role;

revoke execute on function create_sale(uuid, jsonb, sale_payment_method, numeric, integer, date, text) from public, anon;
grant execute on function create_sale(uuid, jsonb, sale_payment_method, numeric, integer, date, text) to authenticated;
revoke execute on function register_payment(uuid, numeric, sale_payment_method, date, text) from public, anon;
grant execute on function register_payment(uuid, numeric, sale_payment_method, date, text) to authenticated;
revoke execute on function register_expense(text, text, numeric, date, text) from public, anon;
grant execute on function register_expense(text, text, numeric, date, text) to authenticated;

revoke all on table v_customer_balance from anon;
grant select on table v_customer_balance to authenticated;

-- Trigger functions stay internal; business RPCs run as caller so RLS remains active.

-- Índices adicionais recomendados pelo advisor de performance
create index if not exists idx_inv_mov_sale_id on public.inventory_movements(sale_id);
create index if not exists idx_sale_items_variant_id on public.sale_items(product_variant_id);
