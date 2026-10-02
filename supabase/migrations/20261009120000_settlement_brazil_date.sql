-- Acerto com colaboradores: lançamentos do acerto usam a data de Brasília.
-- Antes, o banco (em UTC) gravava o dia seguinte quando o acerto era feito depois das 21h.
-- Pode ser executada mais de uma vez com segurança.

create or replace function public.settle_collaborator(
  p_collaborator_id uuid,
  p_commission_percent numeric,
  p_period_end date default (now() at time zone 'America/Sao_Paulo')::date
)
returns numeric
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_owner_id uuid := private.current_owner_id();
  v_preview record;
  v_commission numeric(12,2);
  v_result numeric(12,2);
  v_label text;
  -- Data de hoje no horário de Brasília (o banco roda em UTC e virava o dia às 21h).
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if p_commission_percent is null or p_commission_percent < 0 or p_commission_percent > 100 then
    raise exception 'Percentual de comissão inválido';
  end if;
  if p_period_end is null or p_period_end > v_today then
    raise exception 'Data final do acerto inválida';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('settle:' || p_collaborator_id::text, 0));

  select * into v_preview from public.collaborator_settlement_preview(p_collaborator_id, p_period_end);
  if v_preview.period_start is not null and p_period_end < v_preview.period_start then
    raise exception 'Este período já foi acertado';
  end if;

  v_commission := round(v_preview.base_amount * p_commission_percent / 100, 2);
  v_result := v_preview.vale_balance + v_commission;
  v_label := 'acerto até ' || to_char(p_period_end, 'DD/MM/YYYY');

  insert into public.collaborator_settlements (
    owner_id, collaborator_id, period_start, period_end, base_amount,
    commission_percent, commission_amount, vale_balance, result
  ) values (
    v_owner_id, p_collaborator_id, v_preview.period_start, p_period_end, v_preview.base_amount,
    p_commission_percent, v_commission, v_preview.vale_balance, v_result
  );

  if v_commission > 0 then
    insert into public.collaborator_vale_movements (owner_id, collaborator_id, movement_type, amount, movement_date, notes)
    values (v_owner_id, p_collaborator_id, 'abatimento', v_commission, v_today,
      'Comissão ' || replace(to_char(p_commission_percent, 'FM990.##'), '.', ',') || '% · ' || v_label);
  end if;

  if v_result > 0 then
    insert into public.collaborator_vale_movements (owner_id, collaborator_id, movement_type, amount, movement_date, notes)
    values (v_owner_id, p_collaborator_id, 'vale', v_result, v_today, 'Pago ao colaborador · ' || v_label);
  elsif v_result < 0 then
    insert into public.collaborator_vale_movements (owner_id, collaborator_id, movement_type, amount, movement_date, notes)
    values (v_owner_id, p_collaborator_id, 'abatimento', -v_result, v_today, 'Devolvido pelo colaborador · ' || v_label);
  end if;

  return v_result;
end;
$function$;
