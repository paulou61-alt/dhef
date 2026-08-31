-- =====================================================================
-- FUNÇÕES ADICIONAIS DE ESTOQUE
-- Execute após 001_initial_schema.sql
-- =====================================================================

-- Ajusta o estoque de uma variante de forma atômica e registra o histórico.
-- p_quantity pode ser positivo (entrada) ou negativo (saída/ajuste para baixo).
create or replace function adjust_stock(
  p_variant_id uuid,
  p_quantity integer,
  p_type movement_type,
  p_reason text default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_variant record;
  v_new_qty integer;
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  select * into v_variant from product_variants
    where id = p_variant_id and user_id = v_user_id
    for update;

  if v_variant is null then
    raise exception 'Variante não encontrada';
  end if;

  v_new_qty := v_variant.stock_quantity + p_quantity;

  if v_new_qty < 0 then
    raise exception 'Estoque não pode ficar negativo (atual: %, ajuste: %)', v_variant.stock_quantity, p_quantity;
  end if;

  update product_variants set stock_quantity = v_new_qty where id = p_variant_id;

  insert into inventory_movements (user_id, product_variant_id, type, quantity, reason)
  values (v_user_id, p_variant_id, p_type, p_quantity, p_reason);
end;
$$;


revoke execute on function adjust_stock(uuid, integer, movement_type, text) from public, anon;
grant execute on function adjust_stock(uuid, integer, movement_type, text) to authenticated;
