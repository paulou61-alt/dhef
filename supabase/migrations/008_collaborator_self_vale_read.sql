drop policy if exists collaborator_vales_select_owner on public.collaborator_vale_movements;
drop policy if exists collaborator_vales_select_owner_or_self on public.collaborator_vale_movements;

create policy collaborator_vales_select_owner_or_self
on public.collaborator_vale_movements
for select
to authenticated
using (
  (
    owner_id = (select auth.uid())
    and (select private.current_access_role()) = 'owner'::text
  )
  or collaborator_id = (select private.current_collaborator_id())
);
