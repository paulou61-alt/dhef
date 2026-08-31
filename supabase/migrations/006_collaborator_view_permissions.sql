alter table public.collaborators
  alter column username drop not null,
  alter column email drop not null;

alter table public.collaborators
  add column if not exists view_permissions text[] not null default '{}'::text[];

update public.collaborators
set view_permissions = case
  when role::text = 'vendedor' then array['inicio','vender','clientes','fichas']::text[]
  when role::text = 'cobrador' then array['cobrancas','clientes','fichas']::text[]
  else '{}'::text[]
end
where coalesce(cardinality(view_permissions), 0) = 0;

alter table public.collaborators
  drop constraint if exists collaborators_view_permissions_check;

alter table public.collaborators
  add constraint collaborators_view_permissions_check
  check (view_permissions <@ array['inicio','vender','clientes','fichas','cobrancas']::text[]);
