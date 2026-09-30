-- =====================================================================
-- Correção OPCIONAL para a tabela detox_products (produtos "Detox Mary").
--
-- Esta tabela é de outro sistema que usa o mesmo projeto do Supabase.
-- Hoje, qualquer dono de empresa do sistema de vendas que tenha pelo
-- menos um colaborador cadastrado consegue criar, alterar e apagar os
-- produtos da Detox Mary (regras "Owners can ... Detox Mary products").
--
-- Esta correção remove essas três regras. Continuam valendo:
--   * a regra pública de leitura dos produtos ativos (vitrine);
--   * as regras do administrador detoxmary@gmail.com (criar, ver,
--     alterar e apagar).
-- Também retira de visitantes sem login (anon) as permissões de escrita,
-- mantendo só a leitura.
--
-- Rode SOMENTE se a Detox Mary é sua e o administrador dela é quem
-- entra com o e-mail detoxmary@gmail.com.
-- =====================================================================

drop policy if exists "Owners can insert Detox Mary products" on public.detox_products;
drop policy if exists "Owners can update Detox Mary products" on public.detox_products;
drop policy if exists "Owners can delete Detox Mary products" on public.detox_products;

revoke insert, update, delete, truncate, references, trigger on table public.detox_products from anon;
revoke truncate, references, trigger on table public.detox_products from authenticated;
