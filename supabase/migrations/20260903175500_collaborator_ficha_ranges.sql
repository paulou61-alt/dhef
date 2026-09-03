drop index if exists public.customers_user_ficha_number_key;

alter table public.customers
  drop constraint if exists customers_ficha_number_positive;

alter table public.customers
  drop constraint if exists customers_ficha_number_range;

alter table public.customers
  add constraint customers_ficha_number_range
  check (ficha_number between 1 and 1000);

create unique index if not exists customers_owner_collaborator_ficha_key
  on public.customers (user_id, assigned_collaborator_id, ficha_number)
  where assigned_collaborator_id is not null;

create unique index if not exists customers_owner_unassigned_ficha_key
  on public.customers (user_id, ficha_number)
  where assigned_collaborator_id is null;

create or replace function private.prepare_customer_ficha()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  if tg_op = 'UPDATE' and new.ficha_number is distinct from old.ficha_number then
    raise exception 'A numeração da ficha não pode ser alterada';
  end if;

  if new.ficha_number is null then
    raise exception 'O número da ficha é obrigatório';
  end if;

  if new.ficha_number < 1 or new.ficha_number > 1000 then
    raise exception 'O número da ficha deve estar entre 1 e 1000';
  end if;

  if new.assigned_collaborator_id is not null and not exists (
    select 1
    from public.collaborators c
    where c.id = new.assigned_collaborator_id
      and c.owner_id = new.user_id
  ) then
    raise exception 'Colaborador responsável inválido';
  end if;

  return new;
end;
$function$;
