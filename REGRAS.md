# REGRAS.md — Regras de negócio do AGC

Documento em linguagem de negócio. Cada regra tem um teste em `src/test/` que a trava.
**Confirmado** = comportamento lido no código e coberto por teste. **A confirmar** = o Murano precisa dizer se é isso mesmo que quer.
Sem nomes de pessoas, metas ou clientes (repositório público).

## Status do cliente (Ativo / Risco / Inativo)
Calculado no navegador a partir dos dias desde a última compra e do ciclo médio de compra. (`recalcClientes.ts`, `recalcClientes.test.ts`)
- **Dias sem compra** = hoje − data da última compra (nunca negativo).
- **Com ciclo médio (> 0 dias):** Ativo abaixo de 1,5 ciclo; Risco de 1,5 até 2,5 ciclos; Inativo a partir de 2,5 ciclos.
- **Sem ciclo médio (cliente com uma só compra):** Ativo até 60 dias; Risco de 61 a 120; Inativo acima de 120.
- **Próxima ação:** cliente Ativo → "Visitar em Nd" (dias que faltam para completar o ciclo) ou "Visitar hoje"; Risco ou Inativo → "Contato urgente".
- **Objetivo mensal** = o maior entre o objetivo anterior e 110% da média mensal. O objetivo só sobe, nunca desce.

## Indicadores a partir dos pedidos (CSV / banco)
(`csvParser.ts`, `csvParser.test.ts`)
- **Ciclo médio** = média de dias entre datas de compra distintas (vários pedidos no mesmo dia contam como uma data).
- **Faturamento do mês** = vendas − devoluções. **MCC** = meses com faturamento positivo.
- **Média mensal (TM)** = soma dos 11 meses anteriores ao mês atual ÷ 11. O mês corrente não entra.
- **N pedidos** conta só vendas.
- Com período selecionado, pedidos fora dele saem do faturamento do período mas ficam no histórico; dias sem compra são medidos até o fim do período.
- Vendedor é padronizado (primeira letra maiúscula; apelido antigo "jaques" → "Jacques"). Nome contendo "interior" → região interior.
- **A confirmar:** valor com ponto de milhar ("1.234,50") é lido como 1,234 — o CSV precisa vir sem milhar. Hoje há teste marcando esse comportamento.

## Agenda de visitas
(`agendaService.ts`, `agendaService.test.ts`)
- Só terça a sexta. Mínimo gerado automaticamente: 4 visitas por dia; máximo por dia: 12 (inclui adições manuais).
- A geração considera só clientes da **capital** do vendedor, de **hoje em diante** (histórico nunca é alterado) e apaga antes só as visitas **automáticas** futuras do vendedor naquele mês (manuais ficam).
- Cada cliente aparece de 1 a 4 vezes no mês (`visitas_mes_sugeridas`). A 1ª visita de todos vem antes da 2ª visita de qualquer um; dentro de cada rodada, maior score RFM primeiro.
- Espaçamento entre visitas do mesmo cliente: 3 dias úteis (1ª→2ª), 2 dias úteis nas seguintes; se não couber, relaxa, mas nunca duas no mesmo dia.
- Turno: ordens 1–2 manhã, 3–4 tarde. Visita nova nasce zerada (sem venda, sem resultado).
- Se os dias acabam, o que sobra não é agendado (capacidade = 4 × dias úteis restantes).
- Semana vai de segunda a domingo e é identificada pela terça. **A confirmar:** a segunda-feira cai na terça *seguinte*.

## Metas e dias úteis
(`metasService.ts`, `metasService.test.ts`)
- Dias do mês para metas: segunda a sábado úteis, domingo não. (Diferente da agenda, que é terça a sexta.)
- **Tendência** = (faturamento até agora ÷ dias úteis corridos) × total de dias úteis do mês; zero se nenhum dia útil passou.

## Inadimplência
(`inadimplenciaService.ts`, `inadimplenciaService.test.ts`)
- Só clientes ativos da carteira de grandes contas; cobranças com status "overdue".
- Mesma cobrança repetida (por pedido) conta uma vez; documento repetido (matriz/filial) é consultado uma vez.
- Ordenado do mais atrasado ao menos. Resultado em cache por 5 minutos por vendedor.
- Custo atual: uma chamada à RPC por documento (limite 50 linhas por chamada, 8 em paralelo). Pendência técnica para consolidar.

## Regras que vivem no banco (ainda sem teste automático)
- Views `vw_grandes_contas`, `vw_inteligencia_agenda`, `vw_agc_agenda_semanal`: definem score RFM, visitas sugeridas e prioridade.
- **Janela de transferência de clientes:** trigger permite transferir só nos dias 1 a 5 do mês (outubro/2026 até o dia 9), com configuração de bypass.
- Filtros de faturamento por tipo e posição (pedidos cancelados etc.) em `fetchPedidosRawFromDB`.
- **A confirmar:** limites de mês na tela (front) e nas views (banco) podem divergir em um dia.

## Segurança (resumo)
Ver "Dívidas conhecidas" no `CLAUDE.md`.
