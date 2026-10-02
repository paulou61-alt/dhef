-- "Quem cobrou": o proprietário escolhe o cobrador ao registrar um recebimento.
-- O recebimento é gravado normalmente e, em seguida, recebe o cobrador.
-- Um mesmo recebimento pode gerar vários registros (excedente abatido nas
-- próximas parcelas); todos foram gravados na mesma transação e por isso têm
-- o mesmo created_at, que é usado para encontrá-los.
-- Pode ser executada mais de uma vez com segurança.

create or replace function public.set_payment_collector(
  p_installment_id uuid,
  p_collector_id uuid
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_owner_id uuid := private.current_owner_id();
  v_created_at timestamptz;
  v_count integer;
begin
  if auth.uid() is null or v_owner_id is null or private.current_access_role() <> 'owner' then
    raise exception 'Apenas o proprietário pode escolher quem cobrou';
  end if;

  if not exists (
    select 1 from public.collaborators c
    where c.id = p_collector_id and c.owner_id = v_owner_id and c.role = 'cobrador'
  ) then
    raise exception 'Cobrador inválido';
  end if;

  -- Último recebimento lançado pelo proprietário nesta parcela.
  select p.created_at into v_created_at
  from public.payments p
  where p.installment_id = p_installment_id
    and p.user_id = v_owner_id
    and p.collected_by_collaborator_id is null
  order by p.created_at desc
  limit 1;

  if v_created_at is null then raise exception 'Recebimento não encontrado'; end if;

  update public.payments
  set collected_by_collaborator_id = p_collector_id
  where user_id = v_owner_id
    and collected_by_collaborator_id is null
    and created_at = v_created_at;

  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

revoke all on function public.set_payment_collector(uuid, uuid) from public, anon;
grant execute on function public.set_payment_collector(uuid, uuid) to authenticated;
