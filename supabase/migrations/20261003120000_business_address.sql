-- =====================================================================
-- Cidade e estado do negócio (Configurações).
-- Servem de padrão no cadastro de clientes, para não escolher o estado
-- toda vez. Pode ser executada mais de uma vez com segurança.
-- =====================================================================

alter table public.profiles add column if not exists city text;
alter table public.profiles add column if not exists state text;

-- Colaboradores também cadastram clientes, mas não leem o perfil do dono.
-- Esta função devolve só a cidade e o estado da empresa de quem está logado.
create or replace function public.get_business_defaults()
returns table (city text, state text)
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $function$
  select p.city, p.state
  from public.profiles p
  where p.id = private.current_owner_id();
$function$;

revoke all on function public.get_business_defaults() from public, anon;
grant execute on function public.get_business_defaults() to authenticated;
