import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { criarClienteFake, type ClienteFake } from "./helpers/supabaseFake";

const fake = vi.hoisted(() => ({ atual: null as any }));
vi.mock("@/integrations/supabase/externalClient", () => ({
  externalSupabase: {
    from: (...a: unknown[]) => fake.atual.from(...a),
    rpc: (...a: unknown[]) => fake.atual.rpc(...a),
  },
}));

import {
  diasDaSemana,
  gerarAgendaMes,
  getDiasUteis,
  getTerca,
  mesRefDe,
  parseISODate,
  toISODate,
  VISITAS_MAX,
  VISITAS_OBRIGATORIAS,
} from "@/lib/agendaService";

/**
 * Regras da agenda de visitas. Ver REGRAS.md, seção "Agenda".
 * "Hoje" = quinta-feira 05/11/2026 (horário local).
 */

const HOJE = new Date(2026, 10, 5, 12, 0, 0);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(HOJE);
});
afterEach(() => {
  vi.useRealTimers();
});

describe("datas da agenda", () => {
  it("toISODate / parseISODate usam o dia local e fazem o caminho de ida e volta", () => {
    expect(toISODate(new Date(2026, 0, 9))).toBe("2026-01-09");
    const d = parseISODate("2026-11-05");
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 10, 5]);
  });

  it("mesRefDe devolve YYYY-MM", () => {
    expect(mesRefDe(new Date(2026, 10, 5))).toBe("2026-11");
    expect(mesRefDe(new Date(2026, 0, 31))).toBe("2026-01");
  });

  it("getTerca devolve a terça da semana (semana vai de segunda a domingo)", () => {
    expect(toISODate(getTerca(new Date(2026, 10, 5)))).toBe("2026-11-03"); // quinta
    expect(toISODate(getTerca(new Date(2026, 10, 3)))).toBe("2026-11-03"); // própria terça
    expect(toISODate(getTerca(new Date(2026, 10, 8)))).toBe("2026-11-03"); // domingo
    // COMPORTAMENTO ATUAL: a segunda-feira cai na terça SEGUINTE, não na anterior.
    expect(toISODate(getTerca(new Date(2026, 10, 9)))).toBe("2026-11-10");
  });

  it("diasDaSemana devolve terça a sexta", () => {
    const dias = diasDaSemana(new Date(2026, 10, 3)).map(toISODate);
    expect(dias).toEqual(["2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06"]);
  });

  it("getDiasUteis considera só terça a sexta", () => {
    const dias = getDiasUteis("2026-11");
    expect(dias[0]).toBe("2026-11-03");
    expect(dias).toHaveLength(16);
    expect(dias.every(d => {
      const dow = parseISODate(d).getDay();
      return dow >= 2 && dow <= 5;
    })).toBe(true);
    expect(dias).not.toContain("2026-11-09"); // segunda
    expect(dias).not.toContain("2026-11-30"); // segunda
  });
});

describe("limites", () => {
  it("4 visitas obrigatórias por dia e no máximo 12", () => {
    expect(VISITAS_OBRIGATORIAS).toBe(4);
    expect(VISITAS_MAX).toBe(12);
  });
});

describe("gerarAgendaMes", () => {
  const inteligencia = (cod: number, o: Record<string, unknown> = {}) => ({
    cod_cliente: cod,
    vendedor: "Maria",
    regiao: "capital",
    nome: `Cliente ${cod}`,
    score_rfm: 50,
    visitas_mes_sugeridas: 1,
    prioridade_sugerida: "normal",
    motivo_prioridade: "",
    ...o,
  });

  const montar = (clientes: unknown[]): ClienteFake => {
    const f = criarClienteFake({
      from: tabela => (tabela === "vw_inteligencia_agenda" ? { data: clientes, error: null } : { data: [], error: null }),
    });
    fake.atual = f;
    return f;
  };

  const inseridos = (f: ClienteFake) =>
    f.daTabela("agenda_gc")
      .filter(c => f.arg(c, "insert"))
      .flatMap(c => f.arg(c, "insert")![0] as any[]);

  it("sem clientes não gera nada e não apaga nada", async () => {
    const f = montar([]);
    expect(await gerarAgendaMes("Maria", "2026-11")).toBe(0);
    expect(f.daTabela("agenda_gc")).toHaveLength(0);
  });

  it("mês que já acabou não gera nem apaga nada", async () => {
    const f = montar([inteligencia(1)]);
    expect(await gerarAgendaMes("Maria", "2026-10")).toBe(0);
    expect(f.daTabela("agenda_gc")).toHaveLength(0);
  });

  it("consulta só clientes da capital do vendedor", async () => {
    const f = montar([inteligencia(1)]);
    await gerarAgendaMes("Maria", "2026-11");
    const consulta = f.daTabela("vw_inteligencia_agenda")[0];
    const eqs = consulta.log.filter(r => r.nome === "eq").map(r => r.args);
    expect(eqs).toContainEqual(["vendedor", "Maria"]);
    expect(eqs).toContainEqual(["regiao", "capital"]);
  });

  it("apaga só a agenda automática do vendedor/mês de hoje em diante (preserva histórico e visitas manuais)", async () => {
    const f = montar([inteligencia(1)]);
    await gerarAgendaMes("Maria", "2026-11");
    const del = f.daTabela("agenda_gc").find(c => c.log.some(r => r.nome === "delete"))!;
    const eqs = del.log.filter(r => r.nome === "eq").map(r => r.args);
    expect(eqs).toContainEqual(["vendedor", "Maria"]);
    expect(eqs).toContainEqual(["mes_referencia", "2026-11"]);
    expect(eqs).toContainEqual(["gerado_automaticamente", true]);
    expect(f.arg(del, "gte")).toEqual(["data_visita", "2026-11-05"]);
  });

  it("apaga antes de inserir", async () => {
    const f = montar([inteligencia(1)]);
    await gerarAgendaMes("Maria", "2026-11");
    const metodos = f.daTabela("agenda_gc").map(c => (c.log.some(r => r.nome === "delete") ? "delete" : "insert"));
    expect(metodos).toEqual(["delete", "insert"]);
  });

  it("só agenda de hoje em diante, em terça a sexta, com no máximo 4 por dia", async () => {
    const clientes = Array.from({ length: 30 }, (_, i) => inteligencia(i + 1));
    const f = montar(clientes);
    const total = await gerarAgendaMes("Maria", "2026-11");
    const linhas = inseridos(f);
    expect(total).toBe(30);
    expect(linhas).toHaveLength(30);

    const porDia: Record<string, number> = {};
    for (const l of linhas) {
      expect(l.data_visita >= "2026-11-05").toBe(true);
      const dow = parseISODate(l.data_visita).getDay();
      expect(dow >= 2 && dow <= 5).toBe(true);
      porDia[l.data_visita] = (porDia[l.data_visita] || 0) + 1;
    }
    expect(Math.max(...Object.values(porDia))).toBe(4);
    // preenche os dias em sequência, sem pular dia
    expect(Object.keys(porDia).sort()[0]).toBe("2026-11-05");
  });

  it("turno: 1ª e 2ª visitas do dia de manhã, 3ª e 4ª à tarde", async () => {
    const f = montar(Array.from({ length: 4 }, (_, i) => inteligencia(i + 1)));
    await gerarAgendaMes("Maria", "2026-11");
    const linhas = inseridos(f);
    expect(linhas.map(l => [l.ordem, l.turno])).toEqual([
      [1, "manha"], [2, "manha"], [3, "tarde"], [4, "tarde"],
    ]);
  });

  it("maior score RFM entra primeiro", async () => {
    const f = montar([
      inteligencia(1, { score_rfm: 10 }),
      inteligencia(2, { score_rfm: 90 }),
      inteligencia(3, { score_rfm: 50 }),
    ]);
    await gerarAgendaMes("Maria", "2026-11");
    expect(inseridos(f).map(l => l.cod_cliente)).toEqual([2, 3, 1]);
  });

  it("primeira visita de todos os clientes vem antes da segunda visita de qualquer um", async () => {
    const f = montar([
      inteligencia(1, { score_rfm: 99, visitas_mes_sugeridas: 2 }),
      inteligencia(2, { score_rfm: 1, visitas_mes_sugeridas: 1 }),
    ]);
    await gerarAgendaMes("Maria", "2026-11");
    const ordem = inseridos(f).map(l => l.cod_cliente);
    expect(ordem.slice(0, 2).sort()).toEqual([1, 2]);
    expect(ordem[2]).toBe(1);
  });

  it("cliente com 4 visitas sugeridas é espaçado (3, 2 e 2 dias úteis entre elas)", async () => {
    const f = montar([inteligencia(1, { visitas_mes_sugeridas: 4 })]);
    await gerarAgendaMes("Maria", "2026-11");
    expect(inseridos(f).map(l => l.data_visita)).toEqual([
      "2026-11-05", "2026-11-11", "2026-11-13", "2026-11-18",
    ]);
  });

  it("visitas sugeridas são limitadas a 1–4 (0 vira 1, 9 vira 4)", async () => {
    const f = montar([
      inteligencia(1, { visitas_mes_sugeridas: 0 }),
      inteligencia(2, { visitas_mes_sugeridas: 9 }),
    ]);
    const total = await gerarAgendaMes("Maria", "2026-11");
    expect(total).toBe(5);
  });

  it("nunca agenda o mesmo cliente duas vezes no mesmo dia", async () => {
    const f = montar([inteligencia(1, { visitas_mes_sugeridas: 4 })]);
    await gerarAgendaMes("Maria", "2026-11");
    const datas = inseridos(f).map(l => l.data_visita);
    expect(new Set(datas).size).toBe(datas.length);
  });

  it("para quando todos os dias estão cheios (capacidade do mês = 4 × dias restantes)", async () => {
    // de 05/11 em diante há 14 dias úteis → 56 vagas
    const f = montar(Array.from({ length: 60 }, (_, i) => inteligencia(i + 1)));
    const total = await gerarAgendaMes("Maria", "2026-11");
    expect(total).toBe(56);
  });

  it("insere em lotes de 50", async () => {
    const f = montar(Array.from({ length: 60 }, (_, i) => inteligencia(i + 1)));
    await gerarAgendaMes("Maria", "2026-11");
    const lotes = f.daTabela("agenda_gc")
      .filter(c => f.arg(c, "insert"))
      .map(c => (f.arg(c, "insert")![0] as unknown[]).length);
    expect(lotes).toEqual([50, 6]);
  });

  it("toda visita nova começa zerada e marcada como gerada automaticamente", async () => {
    const f = montar([inteligencia(1, { prioridade_sugerida: "urgente", motivo_prioridade: "Sumiu" })]);
    await gerarAgendaMes("Maria", "2026-11");
    const [v] = inseridos(f);
    expect(v).toMatchObject({
      vendedor: "Maria",
      status: "agendada",
      vendeu: false,
      valor_venda: 0,
      resultado: null,
      prospeccao: false,
      venda_confirmada: false,
      mes_referencia: "2026-11",
      gerado_automaticamente: true,
      prioridade: "urgente",
      motivo_prioridade: "Sumiu",
    });
  });

  it("erro ao apagar interrompe antes de inserir", async () => {
    const f = criarClienteFake({
      from: (tabela, log) => {
        if (tabela === "vw_inteligencia_agenda") return { data: [inteligencia(1)], error: null };
        if (log.some(r => r.nome === "delete")) return { data: null, error: new Error("falhou") };
        return { data: [], error: null };
      },
    });
    fake.atual = f;
    await expect(gerarAgendaMes("Maria", "2026-11")).rejects.toThrow("falhou");
    expect(f.daTabela("agenda_gc").filter(c => f.arg(c, "insert"))).toHaveLength(0);
  });
});
