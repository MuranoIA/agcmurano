import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatDateOnly, parseCSV, parsePedidoDate, processPedidos, type Pedido } from "@/lib/csvParser";

/**
 * Cálculo dos indicadores do cliente a partir dos pedidos (ciclo médio, status,
 * média mensal, objetivo). Ver REGRAS.md, seções "Status do cliente" e "Média mensal".
 *
 * "Hoje" fixado em 05/11/2026 ao meio-dia (horário local, como o código usa).
 */

const HOJE = new Date(2026, 10, 5, 12, 0, 0);

const pedido = (o: Partial<Pedido> & { data: Date }): Pedido => ({
  pedido: "1",
  codCliente: "100",
  nome: "Cliente 100",
  vendedor: "Vendedor",
  valor: 100,
  tipo: "VENDA",
  ...o,
});

const dia = (ano: number, mes: number, d: number) => new Date(ano, mes - 1, d);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(HOJE);
});
afterEach(() => {
  vi.useRealTimers();
});

describe("datas", () => {
  it("parsePedidoDate lê YYYY-MM-DD como dia local, sem trocar de dia por causa do fuso", () => {
    const d = parsePedidoDate("2026-11-05");
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 10, 5]);
    expect(d.getHours()).toBe(0);
  });

  it("parsePedidoDate devolve data inválida quando não entende o texto", () => {
    expect(isNaN(parsePedidoDate("lixo").getTime())).toBe(true);
  });

  it("formatDateOnly usa os componentes locais e completa com zero", () => {
    expect(formatDateOnly(new Date(2026, 0, 9))).toBe("2026-01-09");
  });
});

describe("parseCSV", () => {
  const cab = "Pedido;Cod_Cliente;Nome;Vendedor;Valor;Data;Tipo";

  it("recusa CSV vazio ou só com cabeçalho", () => {
    expect(() => parseCSV("")).toThrow("CSV vazio ou inválido");
    expect(() => parseCSV(cab)).toThrow("CSV vazio ou inválido");
  });

  it("recusa CSV sem as colunas obrigatórias", () => {
    expect(() => parseCSV("Pedido;Nome\n1;A")).toThrow(/colunas obrigatórias/);
  });

  it("aceita ';' ou ',' como separador", () => {
    const pontoVirgula = parseCSV(`${cab}\n1;100;Salão A;Maria;100,50;2026-10-01;VENDA`);
    const virgula = parseCSV(`${cab.replace(/;/g, ",")}\n1,100,Salão A,Maria,100.50,2026-10-01,VENDA`);
    expect(pontoVirgula.clientes).toHaveLength(1);
    expect(virgula.clientes).toHaveLength(1);
    expect(pontoVirgula.clientes[0].Fat_Total).toBeCloseTo(100.5, 6);
    expect(virgula.clientes[0].Fat_Total).toBeCloseTo(100.5, 6);
  });

  it("ignora linhas curtas, com tipo desconhecido ou com data inválida", () => {
    const csv = [
      cab,
      "1;100;A;Maria;100;2026-10-01;VENDA",
      "2;101;B;Maria;100;2026-10-01", // curta demais
      "3;102;C;Maria;100;2026-10-01;BONUS", // tipo desconhecido
      "4;103;D;Maria;100;data-ruim;VENDA", // data inválida
    ].join("\n");
    const { clientes } = parseCSV(csv);
    expect(clientes.map(c => c.Codigo)).toEqual(["100"]);
  });

  it("padroniza o nome do vendedor (caixa e o apelido antigo 'jaques')", () => {
    const csv = [
      cab,
      "1;100;A;JAQUES;100;2026-10-01;VENDA",
      "2;101;B;jaques interior;100;2026-10-01;VENDA",
      "3;102;C;maria souza;100;2026-10-01;VENDA",
    ].join("\n");
    const { clientes } = parseCSV(csv);
    const porCodigo = Object.fromEntries(clientes.map(c => [c.Codigo, c]));
    expect(porCodigo["100"].Vendedor).toBe("Jacques");
    expect(porCodigo["101"].Vendedor).toBe("Jacques Interior");
    expect(porCodigo["101"].Segmento).toBe("interior");
    expect(porCodigo["102"].Vendedor).toBe("Maria Souza");
    expect(porCodigo["102"].Segmento).toBe("capital");
  });

  it("COMPORTAMENTO ATUAL: valor com ponto de milhar é lido errado (1.234,50 vira 1,234)", () => {
    // Registrado em REGRAS.md como pendência. Se isso for corrigido, atualize este teste.
    const { clientes } = parseCSV(`${cab}\n1;100;A;Maria;1.234,50;2026-10-01;VENDA`);
    expect(clientes[0].Fat_Total).toBeCloseTo(1.234, 6);
  });

  it("valor com vírgula decimal e sem milhar é lido certo", () => {
    const { clientes } = parseCSV(`${cab}\n1;100;A;Maria;1234,50;2026-10-01;VENDA`);
    expect(clientes[0].Fat_Total).toBeCloseTo(1234.5, 6);
  });
});

describe("processPedidos", () => {
  describe("ciclo médio e status", () => {
    it("ciclo médio = média de dias entre datas de compra distintas", () => {
      const { clientes } = processPedidos([
        pedido({ pedido: "1", data: dia(2026, 10, 1) }),
        pedido({ pedido: "2", data: dia(2026, 10, 11) }),
        pedido({ pedido: "3", data: dia(2026, 10, 21) }),
      ]);
      expect(clientes[0].Ciclo_Medio_d).toBe(10);
    });

    it("dois pedidos no mesmo dia contam como uma data só no ciclo, mas dois no total de pedidos", () => {
      const { clientes } = processPedidos([
        pedido({ pedido: "1", data: dia(2026, 10, 1) }),
        pedido({ pedido: "2", data: dia(2026, 10, 1) }),
        pedido({ pedido: "3", data: dia(2026, 10, 11) }),
      ]);
      expect(clientes[0].Ciclo_Medio_d).toBe(10);
      expect(clientes[0].N_Pedidos).toBe(3);
    });

    it("cliente que comprou há pouco tempo está Ativo e com próxima visita calculada", () => {
      // compras em 20/10, 30/10 e 01/11 → ciclo 6; hoje 05/11 → 4 dias sem compra
      const { clientes } = processPedidos([
        pedido({ pedido: "1", data: dia(2026, 10, 20) }),
        pedido({ pedido: "2", data: dia(2026, 10, 30) }),
        pedido({ pedido: "3", data: dia(2026, 11, 1) }),
      ]);
      const c = clientes[0];
      expect(c.Ciclo_Medio_d).toBe(6);
      expect(c.Dias_Sem_Compra).toBe(4);
      expect(c.Status).toBe("Ativo");
      expect(c.Dias_Para_Acao).toBe(2);
      expect(c.Proxima_Acao).toBe("Visitar em 2d");
    });

    it("cliente que passou de 2,5 ciclos sem comprar está Inativo e pede contato urgente", () => {
      // compras a cada 10 dias, última em 21/09 → 45 dias sem compra
      const { clientes } = processPedidos([
        pedido({ pedido: "1", data: dia(2026, 9, 1) }),
        pedido({ pedido: "2", data: dia(2026, 9, 11) }),
        pedido({ pedido: "3", data: dia(2026, 9, 21) }),
      ]);
      const c = clientes[0];
      expect(c.Dias_Sem_Compra).toBe(45);
      expect(c.Status).toBe("Inativo");
      expect(c.Proxima_Acao).toBe("Contato urgente");
    });

    it("cliente com uma única compra usa o limite fixo (60 e 120 dias)", () => {
      const { clientes } = processPedidos([
        pedido({ pedido: "1", data: dia(2026, 10, 6) }), // 30 dias
      ]);
      expect(clientes[0].Ciclo_Medio_d).toBe(0);
      expect(clientes[0].Status).toBe("Ativo");
    });

    it("cliente do AGC sem nenhum faturamento (data nula) fica Inativo e sem datas", () => {
      const { clientes, mesesCols } = processPedidos([
        pedido({ pedido: "", valor: 0, data: new Date(NaN) }),
      ]);
      const c = clientes[0];
      expect(c.Status).toBe("Inativo");
      expect(c.Ultima_Compra).toBe("");
      expect(c.Primeira_Compra).toBe("");
      expect(c.N_Pedidos).toBe(0);
      expect(mesesCols).toEqual([]);
    });
  });

  describe("faturamento por mês", () => {
    it("soma vendas e subtrai devoluções no mês", () => {
      const { clientes, mesesCols } = processPedidos([
        pedido({ pedido: "1", valor: 1000, data: dia(2026, 10, 3) }),
        pedido({ pedido: "2", valor: 200, tipo: "DEV", data: dia(2026, 10, 20) }),
      ]);
      expect(clientes[0].meses["Out/26"]).toBe(800);
      expect(clientes[0].Fat_Total).toBe(800);
      expect(mesesCols).toEqual(["Out/26"]);
    });

    it("N_Pedidos conta só vendas (devolução não conta)", () => {
      const { clientes } = processPedidos([
        pedido({ pedido: "1", data: dia(2026, 10, 3) }),
        pedido({ pedido: "2", tipo: "DEV", data: dia(2026, 10, 20) }),
      ]);
      expect(clientes[0].N_Pedidos).toBe(1);
    });

    it("MCC = quantidade de meses com faturamento positivo", () => {
      const { clientes } = processPedidos([
        pedido({ pedido: "1", valor: 100, data: dia(2026, 8, 3) }),
        pedido({ pedido: "2", valor: 100, data: dia(2026, 9, 3) }),
        pedido({ pedido: "3", valor: 100, data: dia(2026, 10, 3) }),
        pedido({ pedido: "4", valor: 100, tipo: "DEV", data: dia(2026, 10, 4) }), // zera outubro
      ]);
      expect(clientes[0].MCC).toBe(2);
    });

    it("colunas de mês ficam em ordem cronológica, inclusive entre anos", () => {
      const { mesesCols } = processPedidos([
        pedido({ pedido: "1", data: dia(2026, 1, 10) }),
        pedido({ pedido: "2", data: dia(2025, 12, 10) }),
        pedido({ pedido: "3", data: dia(2026, 3, 10) }),
      ]);
      expect(mesesCols).toEqual(["Dez/25", "Jan/26", "Mar/26"]);
    });
  });

  describe("média mensal (TM) e objetivo", () => {
    it("TM_Mes = soma dos 11 meses anteriores ao mês atual ÷ 11 (o mês corrente não entra)", () => {
      // hoje é novembro/26: entram out/26 até dez/25. A venda de novembro fica de fora.
      const { clientes } = processPedidos([
        pedido({ pedido: "1", valor: 1100, data: dia(2026, 10, 3) }),
        pedido({ pedido: "2", valor: 5000, data: dia(2026, 11, 2) }),
      ]);
      expect(clientes[0].TM_Mes).toBeCloseTo(100, 6);
      expect(clientes[0].Objetivo_R$).toBeCloseTo(110, 6);
    });

    it("compra de 12 meses atrás ou mais não entra na média", () => {
      const { clientes } = processPedidos([
        pedido({ pedido: "1", valor: 1100, data: dia(2025, 11, 10) }), // nov/25: fora da janela
      ]);
      expect(clientes[0].TM_Mes).toBe(0);
    });
  });

  describe("período (from / to)", () => {
    it("pedidos fora do período saem do faturamento do período, mas ficam no histórico", () => {
      const { clientes } = processPedidos(
        [
          pedido({ pedido: "1", valor: 100, data: dia(2026, 8, 10) }),
          pedido({ pedido: "2", valor: 300, data: dia(2026, 10, 10) }),
        ],
        { from: dia(2026, 10, 1), to: dia(2026, 10, 31) },
      );
      const c = clientes[0];
      expect(c.Fat_Total).toBe(300);
      expect(c.meses["Ago/26"]).toBeUndefined();
      expect(c.mesesFull?.["Ago/26"]).toBe(100);
    });

    it("cliente cuja primeira compra é depois do fim do período é descartado", () => {
      const { clientes } = processPedidos(
        [pedido({ pedido: "1", data: dia(2026, 10, 10) })],
        { from: dia(2026, 8, 1), to: dia(2026, 8, 31) },
      );
      expect(clientes).toEqual([]);
    });

    it("os dias sem compra são medidos até o fim do período, não até hoje", () => {
      const { clientes } = processPedidos(
        [pedido({ pedido: "1", data: dia(2026, 8, 10) })],
        { from: dia(2026, 8, 1), to: dia(2026, 8, 20) },
      );
      expect(clientes[0].Dias_Sem_Compra).toBe(10);
    });
  });

  it("agrupa pedidos por cliente e preserva nome e vendedor do primeiro pedido", () => {
    const { clientes } = processPedidos([
      pedido({ pedido: "1", codCliente: "100", nome: "Salão A", vendedor: "Maria", data: dia(2026, 10, 1) }),
      pedido({ pedido: "2", codCliente: "200", nome: "Salão B", vendedor: "João", data: dia(2026, 10, 1) }),
      pedido({ pedido: "3", codCliente: "100", nome: "Outro nome", vendedor: "Outro", data: dia(2026, 10, 5) }),
    ]);
    expect(clientes).toHaveLength(2);
    const a = clientes.find(c => c.Codigo === "100")!;
    expect(a.Nome).toBe("Salão A");
    expect(a.Vendedor).toBe("Maria");
    expect(a.N_Pedidos).toBe(2);
  });

  it("usa a região vinda do banco; sem região, deduz 'interior' pelo nome do vendedor", () => {
    const { clientes } = processPedidos([
      pedido({ codCliente: "1", vendedor: "Maria", regiao: "interior", data: dia(2026, 10, 1) }),
      pedido({ codCliente: "2", vendedor: "Maria Interior", data: dia(2026, 10, 1) }),
      pedido({ codCliente: "3", vendedor: "Maria", data: dia(2026, 10, 1) }),
    ]);
    const seg = Object.fromEntries(clientes.map(c => [c.Codigo, c.Segmento]));
    expect(seg).toEqual({ "1": "interior", "2": "interior", "3": "capital" });
  });
});
