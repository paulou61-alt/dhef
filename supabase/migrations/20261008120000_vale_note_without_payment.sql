-- Permite registrar no histórico de vales um acerto sem pagamento
-- ("acerto feito, não pagou"), com valor zero. Não altera nenhum saldo.
-- Pode ser executada mais de uma vez com segurança.

do $$
declare
  v_name text;
begin
  for v_name in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.collaborator_vale_movements'::regclass
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%amount > %'
  loop
    execute format('alter table public.collaborator_vale_movements drop constraint %I', v_name);
  end loop;
end;
$$;

alter table public.collaborator_vale_movements
  drop constraint if exists collaborator_vale_movements_amount_nonnegative;
alter table public.collaborator_vale_movements
  add constraint collaborator_vale_movements_amount_nonnegative check (amount >= 0);
