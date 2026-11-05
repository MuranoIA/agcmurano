import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { recalcAllClientes, recalcCliente } from "@/lib/recalcClientes";
import type { Cliente } from "@/lib/types";

/**
 * Regra de status do cliente (Ativo / Risco / Inativo) calculada no navegador.
 * Ver REGRAS.md, seção "Status do cliente".
 *
 * "Hoje" é fixado em 05/11/2026 12:00 UTC. Para o teste não depender do fuso da
 * máquina, as datas de última compra são montadas em UTC a partir de "há N dias".
 */

const HOJE = new Date("2026-11-05T12:00:00Z");

const haDias = (n: number): string => {
  const d = new Date(Date.UTC(2026, 10, 5 - n));
  return d.toISOString().slice(0, 10);
};

const cliente = (o: Partial<Cliente> = {}): Cliente => ({
  Codigo: "1",
  Nome: "Cliente Teste",
  Vendedor: "Vendedor",
  Objetivo_R$: 0,
  TM_Mes: 1000,
  TM_Pedido: 0,
  Ciclo_Medio_d: 10,
  MCC: 0,
  Meses_1a_Compra: 0,
  Dias_Sem_Compra: 0,
  Status: "Ativo",
  Dias_Para_Acao: 0,
  Proxima_Acao: "",
  N_Pedidos: 0,
  Fat_Total: 0,
  Primeira_Compra: "",
  Ultima_Compra: "",
  Segmento: "capital",
  meses: {},
  ...o,
});

describe("recalcCliente", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(HOJE);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("dias sem compra", () => {
    it("conta os dias desde a última compra", () => {
      const r = recalcCliente(cliente({ Ultima_Compra: haDias(7) }));
      expect(r.Dias_Sem_Compra).toBe(7);
    });

    it("mantém o valor que já veio quando não há última compra", () => {
      const r = recalcCliente(cliente({ Ultima_Compra: "", Dias_Sem_Compra: 42 }));
      expect(r.Dias_Sem_Compra).toBe(42);
    });

    it("mantém o valor que já veio quando a data é inválida", () => {
      const r = recalcCliente(cliente({ Ultima_Compra: "não é data", Dias_Sem_Compra: 33 }));
      expect(r.Dias_Sem_Compra).toBe(33);
    });

    it("nunca fica negativo (compra no futuro conta como 0)", () => {
      const r = recalcCliente(cliente({ Ultima_Compra: "2026-12-01" }));
      expect(r.Dias_Sem_Compra).toBe(0);
    });
  });

  describe("status quando o cliente não tem ciclo médio (ciclo 0)", () => {
    const status = (dias: number) =>
      recalcCliente(cliente({ Ciclo_Medio_d: 0, Ultima_Compra: haDias(dias) })).Status;

    it("até 60 dias é Ativo", () => {
      expect(status(60)).toBe("Ativo");
    });
    it("de 61 a 120 dias é Risco", () => {
      expect(status(61)).toBe("Risco");
      expect(status(120)).toBe("Risco");
    });
    it("acima de 120 dias é Inativo", () => {
      expect(status(121)).toBe("Inativo");
    });
  });

  describe("status quando o cliente tem ciclo médio (ciclo 10)", () => {
    const status = (dias: number) =>
      recalcCliente(cliente({ Ciclo_Medio_d: 10, Ultima_Compra: haDias(dias) })).Status;

    it("abaixo de 1,5 ciclo (15 dias) é Ativo", () => {
      expect(status(14)).toBe("Ativo");
    });
    it("a partir de 1,5 ciclo e abaixo de 2,5 ciclos é Risco", () => {
      expect(status(15)).toBe("Risco");
      expect(status(24)).toBe("Risco");
    });
    it("a partir de 2,5 ciclos (25 dias) é Inativo", () => {
      expect(status(25)).toBe("Inativo");
    });
  });

  describe("próxima ação e dias para a ação", () => {
    it("cliente ativo ainda dentro do ciclo: 'Visitar em Nd'", () => {
      const r = recalcCliente(cliente({ Ciclo_Medio_d: 10, Ultima_Compra: haDias(4) }));
      expect(r.Dias_Para_Acao).toBe(6);
      expect(r.Proxima_Acao).toBe("Visitar em 6d");
    });

    it("cliente ativo que já completou o ciclo: 'Visitar hoje'", () => {
      const noDia = recalcCliente(cliente({ Ciclo_Medio_d: 10, Ultima_Compra: haDias(10) }));
      expect(noDia.Dias_Para_Acao).toBe(0);
      expect(noDia.Proxima_Acao).toBe("Visitar hoje");

      const passouUmPouco = recalcCliente(cliente({ Ciclo_Medio_d: 10, Ultima_Compra: haDias(12) }));
      expect(passouUmPouco.Status).toBe("Ativo");
      expect(passouUmPouco.Dias_Para_Acao).toBe(0);
      expect(passouUmPouco.Proxima_Acao).toBe("Visitar hoje");
    });

    it("cliente em Risco ou Inativo: 'Contato urgente'", () => {
      const risco = recalcCliente(cliente({ Ciclo_Medio_d: 10, Ultima_Compra: haDias(20) }));
      expect(risco.Status).toBe("Risco");
      expect(risco.Proxima_Acao).toBe("Contato urgente");

      const inativo = recalcCliente(cliente({ Ciclo_Medio_d: 10, Ultima_Compra: haDias(60) }));
      expect(inativo.Status).toBe("Inativo");
      expect(inativo.Proxima_Acao).toBe("Contato urgente");
    });
  });

  describe("objetivo (marca d'água)", () => {
    it("usa 110% da média mensal quando não havia objetivo", () => {
      const r = recalcCliente(cliente({ TM_Mes: 1000, Objetivo_R$: 0 }));
      expect(r["Objetivo_R$"]).toBeCloseTo(1100, 6);
    });

    it("mantém o objetivo anterior quando ele é maior que 110% da média", () => {
      const r = recalcCliente(cliente({ TM_Mes: 1000, Objetivo_R$: 1500 }));
      expect(r["Objetivo_R$"]).toBe(1500);
    });

    it("sobe para 110% da média quando o objetivo anterior era menor", () => {
      const r = recalcCliente(cliente({ TM_Mes: 1000, Objetivo_R$: 900 }));
      expect(r["Objetivo_R$"]).toBeCloseTo(1100, 6);
    });
  });

  it("não altera o cliente original e preserva os outros campos", () => {
    const original = cliente({ Ultima_Compra: haDias(70), Ciclo_Medio_d: 10, Nome: "Salão Exemplo" });
    const r = recalcCliente(original);
    expect(original.Status).toBe("Ativo");
    expect(r.Status).toBe("Inativo");
    expect(r.Nome).toBe("Salão Exemplo");
  });
});

describe("recalcAllClientes", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(HOJE);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("recalcula todos, na mesma ordem", () => {
    const lista = [
      cliente({ Codigo: "1", Ciclo_Medio_d: 10, Ultima_Compra: haDias(3) }),
      cliente({ Codigo: "2", Ciclo_Medio_d: 10, Ultima_Compra: haDias(40) }),
    ];
    const r = recalcAllClientes(lista);
    expect(r.map(c => c.Codigo)).toEqual(["1", "2"]);
    expect(r.map(c => c.Status)).toEqual(["Ativo", "Inativo"]);
  });

  it("lista vazia devolve lista vazia", () => {
    expect(recalcAllClientes([])).toEqual([]);
  });
});
