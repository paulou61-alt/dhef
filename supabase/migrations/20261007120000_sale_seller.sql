-- Vendedor responsável escolhido pelo proprietário na tela Nova venda.
-- A venda é criada normalmente e, em seguida, recebe o vendedor.
-- Pode ser executada mais de uma vez com segurança.

create or replace function public.set_sale_seller(
  p_sale_id uuid,
  p_collaborator_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_owner_id uuid := private.current_owner_id();
begin
  if auth.uid() is null or v_owner_id is null or private.current_access_role() <> 'owner' then
    raise exception 'Apenas o proprietário pode escolher o vendedor';
  end if;

  if p_collaborator_id is not null and not exists (
    select 1 from public.collaborators c
    where c.id = p_collaborator_id and c.owner_id = v_owner_id and c.role = 'vendedor'
  ) then
    raise exception 'Vendedor inválido';
  end if;

  update public.sales
  set created_by_collaborator_id = p_collaborator_id
  where id = p_sale_id and user_id = v_owner_id;

  if not found then raise exception 'Venda não encontrada'; end if;
end;
$function$;

revoke all on function public.set_sale_seller(uuid, uuid) from public, anon;
grant execute on function public.set_sale_seller(uuid, uuid) to authenticated;
