-- Vale do colaborador passa a funcionar como um saldo simples.
-- Vale adiciona saldo; abatimento/retirada reduz saldo.
-- Não bloqueamos retiradas maiores que o saldo atual.

create or replace function private.validate_collaborator_vale_movement()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  if not exists (
    select 1
    from public.collaborators c
    where c.id = new.collaborator_id
      and c.owner_id = new.owner_id
  ) then
    raise exception 'Colaborador inválido para este proprietário';
  end if;

  return new;
end;
$function$;
