# Controle de Vendas — Sacoleiros e Pequenos Revendedores

## Etapas já implementadas
1. Arquitetura do projeto
2. Estrutura do banco de dados (SQL completo em `supabase/migrations/`)
3. Autenticação (login, logout, recuperação de senha)
4. Layout principal (sidebar desktop + menu inferior mobile)
5. Dashboard com métricas reais
6. Clientes — CRUD completo, histórico de compras/parcelas, botão "Cobrar no WhatsApp"
7. Produtos — CRUD com variações (gerador cor × tamanho), estoque próprio por variação
8. Estoque — visão geral, alerta de estoque baixo, ajuste manual (entrada/saída/ajuste) com histórico

## Como rodar localmente

### 1. Criar o projeto no Supabase
1. Acesse https://supabase.com/dashboard e crie um novo projeto.
2. Vá em **SQL Editor** e execute, nesta ordem:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_stock_functions.sql`
3. Vá em **Authentication > Providers** e confirme que "Email" está habilitado.
4. Em **Authentication > URL Configuration**, adicione `http://localhost:3000/redefinir-senha` como Redirect URL (e a URL de produção quando fizer deploy).

### 2. Configurar variáveis de ambiente
Copie `.env.example` para `.env.local` e preencha:
- `NEXT_PUBLIC_SUPABASE_URL` — em Project Settings > API > Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — em Project Settings > API > publishable key (recomendada) ou anon public

### 3. Instalar dependências e rodar
```bash
npm install
npm run dev
```
Acesse http://localhost:3000 — você será redirecionado para `/login`.

### 4. Criar seu primeiro usuário
Como ainda não há tela de cadastro pública (proposital — uso próprio por enquanto), crie o usuário direto no Supabase:
Dashboard > Authentication > Users > Add user > preencha e-mail/senha.
O trigger `handle_new_user` já cria o `profile` correspondente automaticamente.

## Próximas etapas (ordem sugerida)
10. Vendas (fluxo "Nova Venda")
11. Contas a receber
12. Pagamentos
13. Despesas
14. Financeiro
15. Relatórios

## Deploy (Vercel)
1. Suba este projeto no GitHub.
2. Importe o repositório na Vercel.
3. Configure as mesmas variáveis de ambiente (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) em Project Settings > Environment Variables.
4. Adicione a URL de produção em Supabase > Authentication > URL Configuration.


## Supabase conectado nesta cópia
Esta cópia já contém `.env.local` apontando para o projeto Supabase configurado nesta conversa. A chave usada é pública/publishable; nenhuma `service_role` foi incluída.
