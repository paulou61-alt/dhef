drop policy if exists products_select_sales on public.products;
create policy products_select_sales
on public.products
for select
to authenticated
using (
  user_id = (select private.current_owner_id())
  and (select private.current_access_role()) in ('owner', 'vendedor', 'cobrador')
);

drop policy if exists variants_select_sales on public.product_variants;
create policy variants_select_sales
on public.product_variants
for select
to authenticated
using (
  user_id = (select private.current_owner_id())
  and (select private.current_access_role()) in ('owner', 'vendedor', 'cobrador')
);
