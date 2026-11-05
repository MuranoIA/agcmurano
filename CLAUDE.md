# CLAUDE.md — AGC Murano

Painel de gestão comercial das Grandes Contas (AGC) da Murano Professional.
Leia também `REGRAS.md` (regras de negócio) antes de mexer em cálculos, status, agenda ou metas.

## Stack
- Vite + React 18 + TypeScript, react-router-dom, shadcn/Radix, Tailwind 3, @tanstack/react-query.
- Testes: `npm test` (vitest + jsdom). Build: `npm run build`. Lint: `npm run lint` (tem pendências antigas; não bloqueia o CI).
- Padrão desejado para novas stacks da Murano (Café Code): Next.js, Tailwind, Material Design, bordas levemente arredondadas. O AGC ainda é Vite; migração só com pedido explícito.

## Onde roda (não usamos Vercel nem Supabase nuvem)
- Deploy: VPS, projeto `agc-oficial` (nginx estático), `agc.muranoprofessional.com.br`.
- **Publicação automática a partir da `main`: merge na `main` = produção.** Nunca fazer merge sem decisão explícita do Murano.
- Dois bancos Supabase na VPS:
  - `supabase` (variáveis `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`, definidas no deploy) → stack **AGC** (`api-agc.muranoprofessional.com.br`): `clientes`, `overlay_*`, `user_roles`, `vendor_email_mapping`.
  - `externalSupabase` (`src/integrations/supabase/externalClient.ts`, variáveis `VITE_CLIENTES_SUPABASE_URL` / `VITE_CLIENTES_SUPABASE_KEY`) → stack **clientes** (`api-clientes.muranoprofessional.com.br`): views `vw_grandes_contas`, `vw_inteligencia_agenda`, tabelas `agenda_gc`, `grandes_contas`, `metas_agc`, `dias_uteis_agc`, `faturamento` etc., RPC `buscar_pagamentos`.
- Nenhum `.env` é versionado. Em desenvolvimento, copie `.env.example` para `.env.local`. Produção usa as variáveis do deploy (`agc-oficial`). Sem `VITE_CLIENTES_SUPABASE_KEY` o app para com erro claro no carregamento.

## Fluxo de trabalho
- Demandas são registradas no Café Code (projeto `agcmurano`), apenas para registro. Perguntas, abertura de PR e decisão de merge acontecem no chat com o Murano.
- Trabalhar em branch, abrir PR, não fazer merge sozinho.
- O repositório é **público**: nunca colocar nomes de vendedores, metas, dados de clientes, chaves ou tokens no código, testes ou docs.
- Antes de alterar uma regra, rodar `npm test`. Se a regra mudou de propósito, atualizar o teste **e** o `REGRAS.md` no mesmo PR.

## Testes
- `src/test/*.test.ts` são testes de caracterização: travam o comportamento atual. Alguns têm o comentário "COMPORTAMENTO ATUAL" quando o comportamento é discutível; ao corrigir, ajuste o teste.
- `src/test/helpers/supabaseFake.ts` simula o cliente Supabase (sem rede). Ver uso em `agendaService.test.ts`.

## Dívidas conhecidas (ordem combinada)
1. ~~Remover `.env` do git e a chave anon fixa em `externalClient.ts`~~ (feito). A chave segue no histórico do git; decidir se o repositório deve ser privado.
2. `buscar_pagamentos` é chamada uma vez por documento (~330 chamadas). Consolidar em uma consulta.
3. Recálculo mensal (`AppDataContext.tsx`, chave `localStorage["ultimo_recalculo_mes"]`) roda no navegador de quem abre primeiro e faz um PATCH por cliente. Mover para uma única escrita em lote por um só ator.
4. Upload de CSV (`upsertClientes`) apaga todos os clientes antes de gravar: usar upsert/transação.
5. `VITE_ANTHROPIC_API_KEY` é lida no front (`dossieService.ts`): qualquer chave nela ficaria exposta no bundle; usar proxy no servidor.
6. Policies permissivas em `overlay_visitas` e leitura anônima de `clientes` (ver demandas no Café Code).
