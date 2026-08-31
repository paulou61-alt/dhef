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

  if tg_op = 'INSERT' and new.ficha_number is null then
    raise exception 'O número da ficha é obrigatório';
  end if;

  if new.ficha_number is not null and new.ficha_number <= 0 then
    raise exception 'O número da ficha deve ser maior que zero';
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

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.customers'::regclass
      and conname = 'customers_ficha_number_positive'
  ) then
    alter table public.customers
      add constraint customers_ficha_number_positive check (ficha_number > 0);
  end if;
end $$;
