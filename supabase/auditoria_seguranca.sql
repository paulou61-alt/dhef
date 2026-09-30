-- =====================================================================
-- Auditoria de segurança (SOMENTE LEITURA — não altera nada).
--
-- Rode no SQL Editor do Supabase e copie o resultado (uma única célula
-- de texto) para revisão. Ele lista:
--   1. tabelas públicas e se a segurança por linha (RLS) está ligada;
--   2. as regras (policies) de cada tabela;
--   3. funções que podem ser chamadas pelo site e se rodam com
--      permissão elevada (security definer);
--   4. o código das funções que decidem quem é dono/colaborador e das
--      que registram vendas e recebimentos.
-- Não mostra dados de clientes, só a estrutura.
-- =====================================================================

with
tabelas as (
  select string_agg(
    format('%s | RLS %s | anon: %s | authenticated: %s',
      c.relname,
      case when c.relrowsecurity then 'ligado' else 'DESLIGADO' end,
      coalesce((select string_agg(privilege_type, ',') from information_schema.role_table_grants g
                where g.table_schema = 'public' and g.table_name = c.relname and g.grantee = 'anon'), '-'),
      coalesce((select string_agg(privilege_type, ',') from information_schema.role_table_grants g
                where g.table_schema = 'public' and g.table_name = c.relname and g.grantee = 'authenticated'), '-')
    ), E'\n' order by c.relname) as txt
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'v', 'm')
),
regras as (
  select string_agg(
    format('%s.%s [%s %s] USING: %s | CHECK: %s',
      tablename, policyname, cmd, array_to_string(roles, ','),
      coalesce(qual, '-'), coalesce(with_check, '-')),
    E'\n' order by tablename, policyname) as txt
  from pg_policies
  where schemaname = 'public'
),
funcoes as (
  select string_agg(
    format('%s.%s(%s) | %s | search_path: %s | anon pode executar: %s | authenticated pode executar: %s',
      n.nspname, p.proname, pg_get_function_identity_arguments(p.oid),
      case when p.prosecdef then 'SECURITY DEFINER' else 'invoker' end,
      coalesce(array_to_string(p.proconfig, ','), 'NÃO DEFINIDO'),
      has_function_privilege('anon', p.oid, 'execute'),
      has_function_privilege('authenticated', p.oid, 'execute')),
    E'\n' order by n.nspname, p.proname) as txt
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'private') and p.prokind = 'f'
),
codigo as (
  select string_agg(pg_get_functiondef(p.oid), E'\n-----\n' order by n.nspname, p.proname) as txt
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where p.prokind = 'f'
    and (n.nspname, p.proname) in (
      ('private', 'current_owner_id'),
      ('private', 'current_access_role'),
      ('private', 'current_collaborator_id'),
      ('private', 'register_payment_impl'),
      ('private', 'create_collection_sale_impl'),
      ('public', 'register_payment_single'),
      ('public', 'create_sale'),
      ('public', 'process_offline_operation'),
      ('public', 'adjust_stock'),
      ('public', 'register_expense')
    )
)
select
  E'=== TABELAS ===\n' || coalesce((select txt from tabelas), '') ||
  E'\n\n=== REGRAS (POLICIES) ===\n' || coalesce((select txt from regras), '') ||
  E'\n\n=== FUNÇÕES ===\n' || coalesce((select txt from funcoes), '') ||
  E'\n\n=== CÓDIGO DAS FUNÇÕES PRINCIPAIS ===\n' || coalesce((select txt from codigo), '')
  as auditoria;
