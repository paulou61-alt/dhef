alter table public.collaborators add column if not exists username text;
alter table public.collaborators alter column invite_expires_at drop not null;

update public.collaborators
set username = lower(regexp_replace(split_part(email, '@', 1), '[^a-zA-Z0-9._-]+', '', 'g'))
where username is null;

update public.collaborators
set username = 'colab-' || substr(id::text, 1, 8)
where username is null or username = '';

with ranked as (
  select id, username, row_number() over (partition by lower(username) order by created_at, id) as rn
  from public.collaborators
)
update public.collaborators c
set username = c.username || '-' || substr(c.id::text, 1, 6)
from ranked r
where r.id = c.id and r.rn > 1;

alter table public.collaborators alter column username set not null;
create unique index if not exists collaborators_username_lower_key on public.collaborators (lower(username));

alter table public.customers add column if not exists ficha_number bigint;
alter table public.customers add column if not exists assigned_collaborator_id uuid references public.collaborators(id) on delete set null;

with numbered as (
  select id, row_number() over (partition by user_id order by created_at, id) as rn
  from public.customers
  where ficha_number is null
)
update public.customers c set ficha_number = n.rn from numbered n where n.id = c.id;

create unique index if not exists customers_user_ficha_number_key on public.customers(user_id, ficha_number);
create index if not exists customers_assigned_collaborator_idx on public.customers(assigned_collaborator_id);

create or replace function private.prepare_customer_ficha()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'UPDATE' and new.ficha_number is distinct from old.ficha_number then
    raise exception 'A numeração da ficha não pode ser alterada';
  end if;

  if tg_op = 'INSERT' and new.ficha_number is null then
    perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));
    select coalesce(max(c.ficha_number), 0) + 1 into new.ficha_number
    from public.customers c where c.user_id = new.user_id;
  end if;

  if new.assigned_collaborator_id is not null and not exists (
    select 1 from public.collaborators c
    where c.id = new.assigned_collaborator_id and c.owner_id = new.user_id
  ) then
    raise exception 'Colaborador responsável inválido';
  end if;

  return new;
end;
$$;

revoke all on function private.prepare_customer_ficha() from public, anon, authenticated;
drop trigger if exists trg_prepare_customer_ficha on public.customers;
create trigger trg_prepare_customer_ficha before insert or update on public.customers
for each row execute function private.prepare_customer_ficha();

alter table public.customers alter column ficha_number set not null;
