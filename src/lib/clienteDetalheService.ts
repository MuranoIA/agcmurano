import { externalSupabase } from "@/integrations/supabase/externalClient";

// ---- TIPOS ----

export interface ClienteCadastro {
  codcli: number;
  cliente: string | null;
  cpf_cnpj: string | null;
  endereco: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  telefone: string | null;
  email: string | null;
  rca_vendedor: string | null;
  rca2_vendedor: string | null;
  ramo: string | null;
  familia: string | null;
  ativo: boolean | null;
  lat_cliente: number | null;
  lng_cliente: number | null;
}

export interface RankingCliente {
  posicao: number;
  total_clientes: number;
  faturamento_liquido: number;
}

export interface ItemCliente {
  departamento: string | null;
  produto: string | null;
  codprod: number | null;
  quantidade: number;
  vlr_item: number;
}

export interface PedidoCliente {
  /** id da linha em faturamento — o mesmo nº de pedido pode ter 2 linhas (venda + devolução) */
  id: number;
  pedido: number;
  data_fat: string | null;
  data_emissao: string | null;
  vlr_atendido: number;
  tipo: string | null;
  posicao: string | null;
}

export interface ProdutoPedido {
  codprod: number | null;
  produto: string | null;
  quantidade: number;
  vlr_item: number;
}

export interface ClienteDetalhe {
  cliente: ClienteCadastro | null;
  ranking: RankingCliente | null;
  itens: ItemCliente[];
  pedidos: PedidoCliente[];
}

const num = (v: unknown): number => Number(v) || 0;

// ---- BUSCA PRINCIPAL ----

/**
 * Carrega tudo que o painel precisa em paralelo. Cada bloco falha isolado —
 * um erro numa das queries não derruba o painel inteiro.
 */
export async function fetchClienteCompleto(codCliente: number): Promise<ClienteDetalhe> {
  const [cliente, ranking, itens, pedidos] = await Promise.all([
    externalSupabase
      .from("clientes")
      .select("codcli, cliente, cpf_cnpj, endereco, bairro, cidade, estado, cep, telefone, email, rca_vendedor, rca2_vendedor, ramo, familia, ativo, lat_cliente, lng_cliente")
      .eq("codcli", codCliente)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return null;
        return {
          ...data,
          lat_cliente: data.lat_cliente == null ? null : num(data.lat_cliente),
          lng_cliente: data.lng_cliente == null ? null : num(data.lng_cliente),
        } as ClienteCadastro;
      })
      .catch(() => null),

    externalSupabase
      .rpc("get_cliente_ranking", { p_codcli: codCliente })
      .then(({ data }) => {
        const row = Array.isArray(data) ? data[0] : data;
        if (!row) return null;
        return {
          posicao: num(row.posicao),
          total_clientes: num(row.total_clientes),
          faturamento_liquido: num(row.faturamento_liquido),
        } as RankingCliente;
      })
      .catch(() => null),

    externalSupabase
      .from("itens")
      .select("departamento, produto, codprod, quantidade, vlr_item")
      .eq("codcli", codCliente)
      .limit(2000)
      .then(({ data }) => (data || []).map(i => ({
        departamento: i.departamento,
        produto: i.produto,
        codprod: i.codprod,
        quantidade: num(i.quantidade),
        vlr_item: num(i.vlr_item),
      })))
      .catch(() => [] as ItemCliente[]),

    externalSupabase
      .from("faturamento")
      .select("id, pedido, data_fat, data_emissao, vlr_atendido, tipo, posicao")
      .eq("codcli", codCliente)
      .order("data_fat", { ascending: false })
      .limit(200)
      .then(({ data }) => (data || []).map(p => ({
        id: p.id,
        pedido: p.pedido,
        data_fat: p.data_fat,
        data_emissao: p.data_emissao,
        vlr_atendido: num(p.vlr_atendido),
        tipo: p.tipo,
        posicao: p.posicao,
      })))
      .catch(() => [] as PedidoCliente[]),
  ]);

  return { cliente, ranking, itens, pedidos };
}

/** Itens de um pedido — carregado sob demanda ao expandir (lazy load). */
export async function fetchProdutosPedido(codCliente: number, pedido: number): Promise<ProdutoPedido[]> {
  const { data, error } = await externalSupabase
    .from("itens")
    .select("codprod, produto, quantidade, vlr_item")
    .eq("cod_pedido", pedido)
    .eq("codcli", codCliente);
  if (error) throw error;
  return (data || []).map(i => ({
    codprod: i.codprod,
    produto: i.produto,
    quantidade: num(i.quantidade),
    vlr_item: num(i.vlr_item),
  }));
}

// ---- AGREGAÇÕES ----

export interface RankingLinha {
  chave: string;
  nome: string;
  codprod?: number | null;
  valor: number;
  qtd: number;
  pct: number;
}

function ordenarComPct(mapa: Map<string, RankingLinha>, campo: "valor" | "qtd", top: number): RankingLinha[] {
  const lista = [...mapa.values()].filter(l => l[campo] > 0).sort((a, b) => b[campo] - a[campo]).slice(0, top);
  const maior = lista[0]?.[campo] || 0;
  return lista.map(l => ({ ...l, pct: maior > 0 ? (l[campo] / maior) * 100 : 0 }));
}

/** Top departamentos por valor faturado. */
export function rankingDepartamentos(itens: ItemCliente[], top = 6): RankingLinha[] {
  const mapa = new Map<string, RankingLinha>();
  for (const i of itens) {
    const nome = i.departamento?.trim() || "Sem departamento";
    const atual = mapa.get(nome) || { chave: nome, nome, valor: 0, qtd: 0, pct: 0 };
    atual.valor += i.vlr_item;
    atual.qtd += i.quantidade;
    mapa.set(nome, atual);
  }
  return ordenarComPct(mapa, "valor", top);
}

/** Top produtos por quantidade comprada. */
export function rankingProdutos(itens: ItemCliente[], top = 6): RankingLinha[] {
  const mapa = new Map<string, RankingLinha>();
  for (const i of itens) {
    const chave = String(i.codprod ?? i.produto ?? "?");
    const atual = mapa.get(chave) || {
      chave,
      nome: i.produto?.trim() || `Produto ${i.codprod ?? "?"}`,
      codprod: i.codprod,
      valor: 0,
      qtd: 0,
      pct: 0,
    };
    atual.valor += i.vlr_item;
    atual.qtd += i.quantidade;
    mapa.set(chave, atual);
  }
  return ordenarComPct(mapa, "qtd", top);
}

// ---- PEDIDOS AGRUPADOS POR MÊS ----

const MESES_LONGOS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export interface GrupoMes {
  chave: string;   // "2026-08" (ou "sem-data")
  label: string;   // "Agosto 2026"
  total: number;   // líquido (devolução entra negativa)
  pedidos: PedidoCliente[];
}

export const isDevolucao = (p: PedidoCliente): boolean => {
  const t = (p.tipo || "").toUpperCase();
  const pos = (p.posicao || "").toUpperCase();
  return t === "DEV" || t.startsWith("DEVOLU") || pos.startsWith("DEV");
};

export function agruparPedidosPorMes(pedidos: PedidoCliente[]): GrupoMes[] {
  const grupos = new Map<string, GrupoMes>();
  for (const p of pedidos) {
    const iso = p.data_fat || p.data_emissao;
    let chave = "sem-data";
    let label = "Sem data";
    if (iso) {
      const d = new Date(iso);
      if (!isNaN(d.getTime())) {
        chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        label = `${MESES_LONGOS[d.getMonth()]} ${d.getFullYear()}`;
      }
    }
    const grupo = grupos.get(chave) || { chave, label, total: 0, pedidos: [] };
    grupo.total += isDevolucao(p) ? -p.vlr_atendido : p.vlr_atendido;
    grupo.pedidos.push(p);
    grupos.set(chave, grupo);
  }
  // Mais recente primeiro; "sem-data" no fim
  return [...grupos.values()].sort((a, b) => {
    if (a.chave === "sem-data") return 1;
    if (b.chave === "sem-data") return -1;
    return b.chave.localeCompare(a.chave);
  });
}

export const errMsgCliente = (e: unknown): string => (e instanceof Error ? e.message : String(e));
