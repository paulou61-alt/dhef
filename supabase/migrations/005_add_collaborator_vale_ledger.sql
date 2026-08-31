create table if not exists public.collaborator_vale_movements (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  collaborator_id uuid not null references public.collaborators(id) on delete cascade,
  movement_type text not null check (movement_type in ('vale', 'abatimento')),
  amount numeric(12,2) not null check (amount > 0),
  movement_date date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists collaborator_vale_owner_idx
  on public.collaborator_vale_movements(owner_id);
create index if not exists collaborator_vale_collaborator_idx
  on public.collaborator_vale_movements(collaborator_id, movement_date desc, created_at desc);

alter table public.collaborator_vale_movements enable row level security;

revoke all on table public.collaborator_vale_movements from anon;
revoke all on table public.collaborator_vale_movements from authenticated;
grant select, insert on table public.collaborator_vale_movements to authenticated;

drop policy if exists collaborator_vales_select_owner on public.collaborator_vale_movements;
create policy collaborator_vales_select_owner
on public.collaborator_vale_movements
for select
to authenticated
using (
  owner_id = (select auth.uid())
  and (select private.current_access_role()) = 'owner'
);

drop policy if exists collaborator_vales_insert_owner on public.collaborator_vale_movements;
create policy collaborator_vales_insert_owner
on public.collaborator_vale_movements
for insert
to authenticated
with check (
  owner_id = (select auth.uid())
  and (select private.current_access_role()) = 'owner'
);

create or replace function private.validate_collaborator_vale_movement()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  current_balance numeric(12,2);
begin
  if not exists (
    select 1
    from public.collaborators c
    where c.id = new.collaborator_id
      and c.owner_id = new.owner_id
  ) then
    raise exception 'Colaborador inválido para este proprietário';
  end if;

  if new.movement_type = 'abatimento' then
    select coalesce(sum(
      case
        when m.movement_type = 'vale' then m.amount
        else -m.amount
      end
    ), 0)
    into current_balance
    from public.collaborator_vale_movements m
    where m.owner_id = new.owner_id
      and m.collaborator_id = new.collaborator_id;

    if new.amount > current_balance then
      raise exception 'O abatimento não pode ser maior que o saldo em vale';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.validate_collaborator_vale_movement() from public, anon, authenticated;

drop trigger if exists trg_validate_collaborator_vale_movement on public.collaborator_vale_movements;
create trigger trg_validate_collaborator_vale_movement
before insert on public.collaborator_vale_movements
for each row execute function private.validate_collaborator_vale_movement();
