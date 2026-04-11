import { Cliente } from "./types";

function detectSeparator(firstLine: string): string {
  const semicolons = (firstLine.match(/;/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  return semicolons >= commas ? ";" : ",";
}

function parseNum(v: string): number {
  if (!v || v.trim() === "") return 0;
  return parseFloat(v.replace(",", ".")) || 0;
}

export function parseCSV(text: string): { clientes: Cliente[]; mesesCols: string[] } {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) throw new Error("CSV vazio ou inválido");

  const sep = detectSeparator(lines[0]);
  const headers = lines[0].split(sep).map(h => h.trim());

  // Detect month columns (pattern: Mmm/AA like Jan/25)
  const mesRegex = /^[A-Za-z]{3}\/\d{2}$/;
  const mesesCols = headers.filter(h => mesRegex.test(h));

  const clientes: Cliente[] = [];

  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(sep);
    if (vals.length < 10) continue;

    const get = (col: string) => {
      const idx = headers.indexOf(col);
      return idx >= 0 && idx < vals.length ? vals[idx].trim() : "";
    };

    const meses: Record<string, number> = {};
    for (const m of mesesCols) {
      meses[m] = parseNum(get(m));
    }

    const status = get("Status") as "Ativo" | "Risco" | "Inativo";

    clientes.push({
      Codigo: get("Codigo"),
      Nome: get("Nome"),
      Vendedor: get("Vendedor"),
      Objetivo_R$: parseNum(get("Objetivo_R$")),
      TM_Mes: parseNum(get("TM_Mes")),
      TM_Pedido: parseNum(get("TM_Pedido")),
      Ciclo_Medio_d: parseNum(get("Ciclo_Medio_d")),
      MCC: parseNum(get("MCC")),
      Meses_1a_Compra: parseNum(get("Meses_1a_Compra")),
      Dias_Sem_Compra: parseNum(get("Dias_Sem_Compra")),
      Status: ["Ativo", "Risco", "Inativo"].includes(status) ? status : "Inativo",
      Dias_Para_Acao: parseNum(get("Dias_Para_Acao")),
      Proxima_Acao: get("Proxima_Acao"),
      N_Pedidos: parseNum(get("N_Pedidos")),
      Fat_Total: parseNum(get("Fat_Total")),
      Primeira_Compra: get("Primeira_Compra"),
      Ultima_Compra: get("Ultima_Compra"),
      Segmento: get("Segmento") || "capital",
      meses,
    });
  }

  return { clientes, mesesCols };
}
