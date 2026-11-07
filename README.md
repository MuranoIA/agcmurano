# AGC Murano

Painel de gestão comercial da Murano Professional (React + Vite + Supabase).

## Rodar localmente

```bash
npm ci
npm run dev      # http://localhost:8080
npm test         # vitest
npm run build    # gera dist/
```

## Deploy

Publicado como site estático na VPS (`agc-oficial` → agc.muranoprofessional.com.br),
a partir da branch `main`.

## Janela de transferência da carteira

A carteira do AGC (`grandes_contas`, banco murano-clientes) só aceita incluir, remover ou
trocar cliente de vendedor do dia 1 até o **dia limite** do mês.

- O dia limite fica em `agc_janela_transferencia`: a linha `padrao` vale para todo mês
  (começou em 9, nov/2026) e uma linha `YYYY-MM` é exceção daquele mês. Aceita de 5 a 31.
- Quem altera: só os e-mails de `agc_janela_editores` (Rômulo e Jonatas), pela tela
  **Configurações → Janela de transferência**. A seção nem aparece para os demais, e as
  funções `agc_definir_janela` / `agc_remover_excecao_janela` recusam outros e-mails.
- Como o banco aplica: a trava original `trg_janela_transferencia_agc` (dias 1–5, dona
  `supabase_admin`) não foi alterada. O gatilho `trg_a_prazo_janela_agc` roda antes dela
  (ordem alfabética) e, dentro do prazo da tabela, liga `app.bypass_janela_transferencia`
  só na transação. Vale para a tela, a sincronização com o Winthor e qualquer outra gravação.
- Os dias 1–5 ficam sempre abertos (a trava original libera sozinha).
- SQL em `supabase/migrations-clientes/`.
- Limite conhecido: o AGC fala com esse banco pela chave pública (anon), então o e-mail
  é informado pela própria tela, como nas metas. A conferência no banco barra a tela e
  usos comuns, mas não substitui uma autenticação no próprio banco.
