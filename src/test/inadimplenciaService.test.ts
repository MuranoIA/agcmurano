import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { criarClienteFake } from "./helpers/supabaseFake";

const fake = vi.hoisted(() => ({ atual: null as any }));
vi.mock("@/integrations/supabase/externalClient", () => ({
  externalSupabase: {
    from: (...a: unknown[]) => fake.atual.from(...a),
    rpc: (...a: unknown[]) => fake.atual.rpc(...a),
  },
}));

import { countInadimplencia, fetchInadimplencia } from "@/lib/inadimplenciaService";

/**
 * Inadimplência: uma chamada à RPC `buscar_pagamentos` por documento de cliente.
 * Ver REGRAS.md, seção "Inadimplência". Estes testes travam o comportamento atual
 * (inclusive o custo de N chamadas) para que a consolidação em uma chamada só seja
 * feita com segurança.
 */

const HOJE = new Date("2026-11-05T12:00:00Z");

// Vendedor único por teste (o cache do serviço é por vendedor e vive entre testes)
const K = { atual: "" };
let contador = 0;

interface Cenario {
  carteira: { cod_cliente: number; vendedor: string }[];
  clientes: { codcli: number; cliente: string | null; cpf_cnpj: string | null }[];
  pagamentos: Record<string, unknown[]>; // por documento (só dígitos)
  rpc?: (termo: string) => Promise<{ data?: unknown; error?: unknown }> | { data?: unknown; error?: unknown };
}

function montar(c: Cenario) {
  c = { ...c, carteira: c.carteira.map(x => (x.vendedor === "v" ? { ...x, vendedor: K.atual } : x)) };
  const f = criarClienteFake({
    from: (tabela, log) => {
      if (tabela === "grandes_contas") return { data: c.carteira, error: null };
      if (tabela === "clientes") {
        // imita o `.in("codcli", [...])` do banco
        const codigos = (log.find(r => r.nome === "in")?.args[1] as number[] | undefined) ?? [];
        return { data: c.clientes.filter(x => codigos.includes(x.codcli)), error: null };
      }
      return { data: [], error: null };
    },
    rpc: (_nome, args) => {
      const termo = (args as { termo: string }).termo;
      if (c.rpc) return c.rpc(termo);
      return { data: c.pagamentos[termo] ?? [], error: null };
    },
  });
  fake.atual = f;
  return f;
}

const pag = (id: string, o: Record<string, unknown> = {}) => ({
  id,
  cliente: "X",
  cpf_cnpj: "x",
  nf: "10",
  pedido: 1,
  forma: "boleto",
  valor: 100,
  vencimento: "2026-10-26",
  status: "overdue",
  link_cobranca: null,
  ...o,
});

beforeEach(() => {
  K.atual = `vend-${++contador}`;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(HOJE);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("fetchInadimplencia", () => {
  it("carteira vazia não chama a RPC", async () => {
    const f = montar({ carteira: [], clientes: [], pagamentos: {} });
    expect(await fetchInadimplencia("vazio", { force: true })).toEqual([]);
    expect(f.rpcs).toHaveLength(0);
  });

  it("só considera a carteira ativa e filtra pelo vendedor sem diferenciar maiúsculas", async () => {
    const f = montar({
      carteira: [
        { cod_cliente: 1, vendedor: "MARIA" },
        { cod_cliente: 2, vendedor: "joão" },
      ],
      clientes: [
        { codcli: 1, cliente: "Salão A", cpf_cnpj: "111" },
        { codcli: 2, cliente: "Salão B", cpf_cnpj: "222" },
      ],
      pagamentos: { "111": [pag("a")], "222": [pag("b")] },
    });
    const r = await fetchInadimplencia(" Maria ", { force: true });
    expect(r.map(b => b.cod_cliente)).toEqual([1]);
    expect(f.rpcs.map(x => x.args)).toEqual([{ termo: "111" }]);
    const gc = f.daTabela("grandes_contas")[0];
    expect(f.arg(gc, "eq")).toEqual(["ativo", true]);
  });

  it("nome do vendedor sai capitalizado", async () => {
    montar({
      carteira: [{ cod_cliente: 1, vendedor: "maria souza" }],
      clientes: [{ codcli: 1, cliente: "Salão A", cpf_cnpj: "111" }],
      pagamentos: { "111": [pag("a")] },
    });
    const [b] = await fetchInadimplencia("maria souza", { force: true });
    expect(b.vendedor).toBe("Maria Souza");
  });

  it("só entram boletos vencidos (status overdue); outros status são ignorados", async () => {
    montar({
      carteira: [{ cod_cliente: 1, vendedor: "v" }],
      clientes: [{ codcli: 1, cliente: "A", cpf_cnpj: "111" }],
      pagamentos: { "111": [pag("a"), pag("b", { status: "paid" }), pag("c", { status: "pending" })] },
    });
    const r = await fetchInadimplencia(K.atual, { force: true });
    expect(r.map(b => b.id)).toEqual(["a"]);
  });

  it("a mesma cobrança repetida (JOIN por pedido) aparece uma vez só", async () => {
    montar({
      carteira: [{ cod_cliente: 1, vendedor: "v" }],
      clientes: [{ codcli: 1, cliente: "A", cpf_cnpj: "111" }],
      pagamentos: { "111": [pag("a", { pedido: 1 }), pag("a", { pedido: 2 })] },
    });
    const r = await fetchInadimplencia(K.atual, { force: true });
    expect(r).toHaveLength(1);
  });

  it("clientes com o mesmo documento (matriz/filial) geram uma chamada só; sem documento são ignorados", async () => {
    const f = montar({
      carteira: [
        { cod_cliente: 1, vendedor: "v" },
        { cod_cliente: 2, vendedor: "v" },
        { cod_cliente: 3, vendedor: "v" },
      ],
      clientes: [
        { codcli: 1, cliente: "Matriz", cpf_cnpj: "11.111.111/0001-11" },
        { codcli: 2, cliente: "Filial", cpf_cnpj: "11111111000111" },
        { codcli: 3, cliente: "Sem doc", cpf_cnpj: null },
      ],
      pagamentos: { "11111111000111": [pag("a")] },
    });
    const r = await fetchInadimplencia(K.atual, { force: true });
    expect(f.rpcs).toHaveLength(1);
    expect(f.rpcs[0].args).toEqual({ termo: "11111111000111" });
    expect(r[0].cliente).toBe("Matriz"); // fica com o primeiro cliente do documento
  });

  it("dias de atraso contam desde o vencimento; ordena do mais atrasado para o menos", async () => {
    montar({
      carteira: [{ cod_cliente: 1, vendedor: "v" }],
      clientes: [{ codcli: 1, cliente: "A", cpf_cnpj: "111" }],
      pagamentos: {
        "111": [
          pag("novo", { vencimento: "2026-11-01" }),
          pag("velho", { vencimento: "2026-09-01" }),
          pag("futuro", { vencimento: "2026-12-01" }),
        ],
      },
    });
    const r = await fetchInadimplencia(K.atual, { force: true });
    expect(r.map(b => [b.id, b.dias_atraso])).toEqual([["velho", 65], ["novo", 4], ["futuro", 0]]);
  });

  it("valor texto vira número; valor inválido vira 0", async () => {
    montar({
      carteira: [{ cod_cliente: 1, vendedor: "v" }],
      clientes: [{ codcli: 1, cliente: "A", cpf_cnpj: "111" }],
      pagamentos: { "111": [pag("a", { valor: "250.5" }), pag("b", { valor: "abc" })] },
    });
    const r = await fetchInadimplencia(K.atual, { force: true });
    expect(Object.fromEntries(r.map(b => [b.id, b.valor]))).toEqual({ a: 250.5, b: 0 });
  });

  it("erro na RPC de um documento não derruba os demais (fica sem boletos e registra no console)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    montar({
      carteira: [{ cod_cliente: 1, vendedor: "v" }, { cod_cliente: 2, vendedor: "v" }],
      clientes: [
        { codcli: 1, cliente: "A", cpf_cnpj: "111" },
        { codcli: 2, cliente: "B", cpf_cnpj: "222" },
      ],
      pagamentos: {},
      rpc: termo =>
        termo === "111" ? { data: null, error: new Error("503") } : { data: [pag("b")], error: null },
    });
    const r = await fetchInadimplencia(K.atual, { force: true });
    expect(r.map(b => b.id)).toEqual(["b"]);
  });

  it("limita a 8 chamadas simultâneas e reporta progresso", async () => {
    let ativas = 0;
    let pico = 0;
    const ids = Array.from({ length: 30 }, (_, i) => i + 1);
    montar({
      carteira: ids.map(i => ({ cod_cliente: i, vendedor: "v" })),
      clientes: ids.map(i => ({ codcli: i, cliente: `C${i}`, cpf_cnpj: String(1000 + i) })),
      pagamentos: {},
      rpc: async () => {
        ativas++;
        pico = Math.max(pico, ativas);
        for (let k = 0; k < 5; k++) await Promise.resolve();
        ativas--;
        return { data: [], error: null };
      },
    });
    const progresso: Array<[number, number]> = [];
    await fetchInadimplencia(K.atual, { force: true, onProgress: (a, b) => progresso.push([a, b]) });
    expect(pico).toBeGreaterThan(1);
    expect(pico).toBeLessThanOrEqual(8);
    expect(progresso[0]).toEqual([0, 30]);
    expect(progresso[progresso.length - 1]).toEqual([30, 30]);
  });

  describe("cache", () => {
    const cenario = (): Cenario => ({
      carteira: [{ cod_cliente: 1, vendedor: "v" }],
      clientes: [{ codcli: 1, cliente: "A", cpf_cnpj: "111" }],
      pagamentos: { "111": [pag("a")] },
    });

    it("segunda chamada em seguida usa o cache (não chama a RPC de novo)", async () => {
      const f = montar(cenario());
      await fetchInadimplencia(K.atual);
      await fetchInadimplencia(K.atual);
      expect(f.rpcs).toHaveLength(1);
    });

    it("chamadas simultâneas compartilham a mesma busca", async () => {
      const f = montar(cenario());
      await Promise.all([fetchInadimplencia(K.atual), fetchInadimplencia(K.atual)]);
      expect(f.rpcs).toHaveLength(1);
    });

    it("force ignora o cache", async () => {
      const f = montar(cenario());
      await fetchInadimplencia(K.atual);
      await fetchInadimplencia(K.atual, { force: true });
      expect(f.rpcs).toHaveLength(2);
    });

    it("o cache vale por 5 minutos", async () => {
      const f = montar(cenario());
      await fetchInadimplencia(K.atual);
      vi.setSystemTime(new Date(HOJE.getTime() + 5 * 60 * 1000 + 1));
      await fetchInadimplencia(K.atual);
      expect(f.rpcs).toHaveLength(2);
    });

    it("cada vendedor tem o seu cache", async () => {
      const f = montar(cenario());
      await fetchInadimplencia("t-a");
      await fetchInadimplencia("t-b");
      expect(f.daTabela("grandes_contas")).toHaveLength(2);
    });

    it("countInadimplencia usa o mesmo cache da lista", async () => {
      const f = montar(cenario());
      await fetchInadimplencia(K.atual);
      expect(await countInadimplencia(K.atual)).toBe(1);
      expect(f.rpcs).toHaveLength(1);
    });
  });
});
