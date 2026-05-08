import { Cliente } from "./types";

const MESES_PT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

const DATE_ONLY_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

function normalizeVendedor(v: string): string {
  if (!v) return "";
  // Aliases
  let key = v.trim().toLowerCase();
  if (key === "jaques") key = "jacques";
  if (key === "jaques interior") key = "jacques interior";
  return key.replace(/\b\w/g, c => c.toUpperCase());
}

function parseNum(v: string): number {
  if (!v || v.trim() === "") return 0;
  return parseFloat(v.replace(",", ".")) || 0;
}

function fmtMesCol(d: Date): string {
  return `${MESES_PT[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`;
}

export function formatDateOnly(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parsePedidoDate(value: string): Date {
  const trimmed = value.trim();
  const dateOnlyMatch = trimmed.match(DATE_ONLY_REGEX);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  const parsed = new Date(trimmed);
  if (isNaN(parsed.getTime())) return parsed;

  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function daysBetween(a: Date, b: Date): number {
  return Math.abs(Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)));
}

export interface Pedido {
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
    const data = parsePedidoDate(dataStr);
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

  return processPedidos(pedidos);
}

export interface ProcessOpts {
  from?: Date;
  to?: Date;
}

export function processPedidos(
  pedidos: Pedido[],
  opts?: ProcessOpts,
): { clientes: Cliente[]; mesesCols: string[] } {
  // Group by client
  const groups: Record<string, Pedido[]> = {};
  for (const p of pedidos) {
    if (!groups[p.codCliente]) groups[p.codCliente] = [];
    groups[p.codCliente].push(p);
  }

  const today = new Date();
  const fromDate = opts?.from
    ? new Date(opts.from.getFullYear(), opts.from.getMonth(), opts.from.getDate())
    : undefined;
  const toDate = opts?.to
    ? new Date(opts.to.getFullYear(), opts.to.getMonth(), opts.to.getDate(), 23, 59, 59, 999)
    : undefined;
  const referenceDate = toDate
    ? new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate())
    : today;

  const inPeriod = (d: Date) => {
    if (fromDate && d < fromDate) return false;
    if (toDate && d > toDate) return false;
    return true;
  };

  const allMesesSet = new Set<string>();

  const clientes: Cliente[] = Object.entries(groups).flatMap(([codigo, peds]) => {
    const nome = peds[0].nome;
    const vendedor = peds[0].vendedor;
    const segmento = vendedor.toLowerCase().includes("interior") ? "interior" : "capital";

    // Drop clients whose first purchase is after referenceDate (didn't exist yet)
    const allDates = peds.map(p => p.data).sort((a, b) => a.getTime() - b.getTime());
    if (allDates[0] > referenceDate) return [];

    // Period-scoped pedidos (used for Fat/meses/N_Pedidos)
    const pedsPeriod = peds.filter(p => inPeriod(p.data));

    // Monthly billing — period-scoped
    const mesesMap: Record<string, number> = {};
    for (const p of pedsPeriod) {
      const mesKey = fmtMesCol(p.data);
      if (!mesesMap[mesKey]) mesesMap[mesKey] = 0;
      mesesMap[mesKey] += p.tipo === "VENDA" ? p.valor : -p.valor;
    }
    Object.keys(mesesMap).forEach(k => allMesesSet.add(k));

    // Full monthly map (used for TM_Mes and full mesesCols set)
    const mesesMapFull: Record<string, number> = {};
    for (const p of peds) {
      const mesKey = fmtMesCol(p.data);
      if (!mesesMapFull[mesKey]) mesesMapFull[mesKey] = 0;
      mesesMapFull[mesKey] += p.tipo === "VENDA" ? p.valor : -p.valor;
    }
    Object.keys(mesesMapFull).forEach(k => allMesesSet.add(k));

    // N_Pedidos (period, VENDA only)
    const vendasPeriod = pedsPeriod.filter(p => p.tipo === "VENDA");
    const nPedidos = vendasPeriod.length;

    // Fat_Total (period net)
    const fatTotal = Object.values(mesesMap).reduce((s, v) => s + v, 0);

    // Full vendas history (for ciclo + ultima compra reference)
    const vendas = peds.filter(p => p.tipo === "VENDA");
    const vendaDates = vendas.map(p => p.data).sort((a, b) => a.getTime() - b.getTime());
    const primeiraCompra = allDates[0];

    // Última compra (full history, mas para DSC consideramos só <= referenceDate)
    const vendaDatesUntilRef = vendaDates.filter(d => d <= referenceDate);
    const ultimaCompraRef = vendaDatesUntilRef.length > 0
      ? vendaDatesUntilRef[vendaDatesUntilRef.length - 1]
      : allDates.filter(d => d <= referenceDate).pop() || allDates[allDates.length - 1];

    // DSC relativo à data final do período
    const dsc = daysBetween(ultimaCompraRef, referenceDate);

    // MCC - months with billing > 0 (period)
    const mcc = Object.values(mesesMap).filter(v => v > 0).length;

    // Ciclo Médio - average days between consecutive unique purchase dates (VENDA only)
    const uniqueVendaDates = [...new Set(vendaDates.map(formatDateOnly))]
      .map(s => parsePedidoDate(s))
      .sort((a, b) => a.getTime() - b.getTime());
    let cicloMedio = 0;
    if (uniqueVendaDates.length > 1) {
      let totalDays = 0;
      for (let i = 1; i < uniqueVendaDates.length; i++) {
        totalDays += daysBetween(uniqueVendaDates[i - 1], uniqueVendaDates[i]);
      }
      cicloMedio = Math.round((totalDays / (uniqueVendaDates.length - 1)) * 10) / 10;
    }

    // TM_Mes - 11 months before fromDate's month (or current month if no period)
    const refMonth = fromDate
      ? new Date(fromDate.getFullYear(), fromDate.getMonth(), 1)
      : new Date(today.getFullYear(), today.getMonth(), 1);
    let tmFat = 0;
    for (let i = 1; i <= 11; i++) {
      const d = new Date(refMonth.getFullYear(), refMonth.getMonth() - i, 1);
      const key = fmtMesCol(d);
      tmFat += mesesMapFull[key] || 0;
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

    return [{
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
      Primeira_Compra: formatDateOnly(primeiraCompra),
      Ultima_Compra: formatDateOnly(ultimaCompraRef),
      Segmento: segmento,
      meses: mesesMap,
    }];
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
