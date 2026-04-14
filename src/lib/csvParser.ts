import { Cliente } from "./types";

const MESES_PT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function normalizeVendedor(v: string): string {
  const map: Record<string, string> = {
    "jaques": "Jacques", "jacques": "Jacques", "hugo": "Hugo", "maiara": "Maiara",
    "jacques interior": "Jacques Interior", "jaques interior": "Jacques Interior",
    "hugo interior": "Hugo Interior", "maiara interior": "Maiara Interior",
  };
  return map[v.trim().toLowerCase()] || v;
}

function parseNum(v: string): number {
  if (!v || v.trim() === "") return 0;
  return parseFloat(v.replace(",", ".")) || 0;
}

function fmtMesCol(d: Date): string {
  return `${MESES_PT[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`;
}

function daysBetween(a: Date, b: Date): number {
  return Math.abs(Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)));
}

interface Pedido {
  pedido: string;
  codCliente: string;
  nome: string;
  vendedor: string;
  valor: number;
  data: Date;
  tipo: "VENDA" | "DEV";
}

export function parseCSV(text: string): { clientes: Cliente[]; mesesCols: string[] } {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) throw new Error("CSV vazio ou inválido");

  // Detect separator
  const firstLine = lines[0];
  const sep = (firstLine.match(/;/g) || []).length >= (firstLine.match(/,/g) || []).length ? ";" : ",";
  const headers = lines[0].split(sep).map(h => h.trim());

  const colIdx = (name: string) => {
    const idx = headers.findIndex(h => h.toLowerCase() === name.toLowerCase());
    return idx;
  };

  const iPedido = colIdx("Pedido");
  const iCod = colIdx("Cod_Cliente");
  const iNome = colIdx("Nome");
  const iVendedor = colIdx("Vendedor");
  const iValor = colIdx("Valor");
  const iData = colIdx("Data");
  const iTipo = colIdx("Tipo");

  if (iCod < 0 || iNome < 0 || iVendedor < 0 || iValor < 0 || iData < 0 || iTipo < 0) {
    throw new Error("CSV inválido: colunas obrigatórias não encontradas (Cod_Cliente, Nome, Vendedor, Valor, Data, Tipo)");
  }

  // Parse all orders
  const pedidos: Pedido[] = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(sep);
    if (vals.length < 6) continue;
    const get = (idx: number) => idx >= 0 && idx < vals.length ? vals[idx].trim() : "";
    const tipo = get(iTipo).toUpperCase();
    if (tipo !== "VENDA" && tipo !== "DEV") continue;
    const dataStr = get(iData);
    const data = new Date(dataStr);
    if (isNaN(data.getTime())) continue;

    pedidos.push({
      pedido: get(iPedido),
      codCliente: get(iCod),
      nome: get(iNome),
      vendedor: normalizeVendedor(get(iVendedor)),
      valor: parseNum(get(iValor)),
      data,
      tipo: tipo as "VENDA" | "DEV",
    });
  }

  // Group by client
  const groups: Record<string, Pedido[]> = {};
  for (const p of pedidos) {
    if (!groups[p.codCliente]) groups[p.codCliente] = [];
    groups[p.codCliente].push(p);
  }

  const today = new Date();
  const allMesesSet = new Set<string>();

  // Calculate Objetivo from previously stored values (persisted in DB)
  // On fresh CSV parse, we just calculate TM * 1.10

  const clientes: Cliente[] = Object.entries(groups).map(([codigo, peds]) => {
    const nome = peds[0].nome;
    const vendedor = peds[0].vendedor;
    const segmento = vendedor.toLowerCase().includes("interior") ? "interior" : "capital";

    // Monthly billing
    const mesesMap: Record<string, number> = {};
    for (const p of peds) {
      const mesKey = fmtMesCol(p.data);
      if (!mesesMap[mesKey]) mesesMap[mesKey] = 0;
      mesesMap[mesKey] += p.tipo === "VENDA" ? p.valor : -p.valor;
    }
    Object.keys(mesesMap).forEach(k => allMesesSet.add(k));

    // N_Pedidos (only VENDA)
    const vendas = peds.filter(p => p.tipo === "VENDA");
    const nPedidos = vendas.length;

    // Fat_Total (sum of all monthly net billing)
    const fatTotal = Object.values(mesesMap).reduce((s, v) => s + v, 0);

    // Dates
    const allDates = peds.map(p => p.data).sort((a, b) => a.getTime() - b.getTime());
    const vendaDates = vendas.map(p => p.data).sort((a, b) => a.getTime() - b.getTime());
    const primeiraCompra = allDates[0];
    const ultimaCompra = vendaDates.length > 0 ? vendaDates[vendaDates.length - 1] : allDates[allDates.length - 1];

    // DSC
    const dsc = daysBetween(ultimaCompra, today);

    // MCC - months with billing > 0
    const mcc = Object.values(mesesMap).filter(v => v > 0).length;

    // Ciclo Médio - average days between consecutive unique purchase dates (VENDA only)
    const uniqueVendaDates = [...new Set(vendaDates.map(d => d.toISOString().split("T")[0]))]
      .map(s => new Date(s))
      .sort((a, b) => a.getTime() - b.getTime());
    let cicloMedio = 0;
    if (uniqueVendaDates.length > 1) {
      let totalDays = 0;
      for (let i = 1; i < uniqueVendaDates.length; i++) {
        totalDays += daysBetween(uniqueVendaDates[i - 1], uniqueVendaDates[i]);
      }
      cicloMedio = totalDays / (uniqueVendaDates.length - 1);
    }

    // TM_Mes - based on 11 months before current month
    const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    let tmFat = 0;
    for (let i = 1; i <= 11; i++) {
      const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - i, 1);
      const key = fmtMesCol(d);
      tmFat += mesesMap[key] || 0;
    }
    const tmMes = tmFat / 11;

    // Objetivo (marca d'água - on fresh parse, just TM * 1.10)
    const objetivoRs = tmMes * 1.10;

    // Status
    let status: Cliente["Status"];
    if (cicloMedio === 0) {
      status = dsc > 120 ? "Inativo" : dsc > 60 ? "Risco" : "Ativo";
    } else if (dsc < 1.5 * cicloMedio) {
      status = "Ativo";
    } else if (dsc < 2.5 * cicloMedio) {
      status = "Risco";
    } else {
      status = "Inativo";
    }

    // Dias_Para_Acao
    const diasParaAcao = Math.max(0, Math.round(cicloMedio - dsc));

    // Proxima_Acao
    let proximaAcao: string;
    if (status === "Risco" || status === "Inativo") {
      proximaAcao = "Contato urgente";
    } else if (diasParaAcao === 0) {
      proximaAcao = "Visitar hoje";
    } else {
      proximaAcao = `Visitar em ${diasParaAcao}d`;
    }

    return {
      Codigo: codigo,
      Nome: nome,
      Vendedor: vendedor,
      Objetivo_R$: objetivoRs,
      TM_Mes: tmMes,
      TM_Pedido: nPedidos > 0 ? fatTotal / nPedidos : 0,
      Ciclo_Medio_d: cicloMedio,
      MCC: mcc,
      Meses_1a_Compra: 0,
      Dias_Sem_Compra: dsc,
      Status: status,
      Dias_Para_Acao: diasParaAcao,
      Proxima_Acao: proximaAcao,
      N_Pedidos: nPedidos,
      Fat_Total: fatTotal,
      Primeira_Compra: primeiraCompra.toISOString().split("T")[0],
      Ultima_Compra: ultimaCompra.toISOString().split("T")[0],
      Segmento: segmento,
      meses: mesesMap,
    };
  });

  // Sort month columns chronologically
  const mesesCols = [...allMesesSet].sort((a, b) => {
    const [ma, ya] = a.split("/");
    const [mb, yb] = b.split("/");
    if (ya !== yb) return ya.localeCompare(yb);
    return MESES_PT.indexOf(ma) - MESES_PT.indexOf(mb);
  });

  return { clientes, mesesCols };
}
