alter function public.register_payment_with_purchase(
  uuid, numeric, public.sale_payment_method, date, text, jsonb,
  public.sale_payment_method, numeric, integer, date, text
) security definer;

revoke all on function private.create_collection_sale_impl(
  uuid, jsonb, public.sale_payment_method, numeric, integer, date, text
) from public;
revoke all on function private.create_collection_sale_impl(
  uuid, jsonb, public.sale_payment_method, numeric, integer, date, text
) from anon;
revoke all on function private.create_collection_sale_impl(
  uuid, jsonb, public.sale_payment_method, numeric, integer, date, text
) from authenticated;

grant execute on function public.register_payment_with_purchase(
  uuid, numeric, public.sale_payment_method, date, text, jsonb,
  public.sale_payment_method, numeric, integer, date, text
) to authenticated;
