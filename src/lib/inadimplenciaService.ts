import { externalSupabase } from "@/integrations/supabase/externalClient";

/**
 * Inadimplência dos clientes do AGC ativo.
 *
 * Não existe tabela de cobranças exposta — a única porta é a RPC `buscar_pagamentos`,
 * que recebe um termo (documento ou nome) e devolve no máximo 50 linhas. Isso obriga
 * uma chamada por documento: ~357 clientes na carteira inteira. Para não repetir esse
 * custo a cada troca de aba, o resultado fica em cache por 5 minutos e chamadas
 * simultâneas com a mesma chave compartilham a mesma promise.
 */

export interface BoletoVencido {
  id: string;
  cod_cliente: number;
  cliente: string;
  cpf_cnpj: string;
  nf: string;
  pedido: number | null;
  forma: string;
  valor: number;
  vencimento: string;
  dias_atraso: number;
  link_cobranca: string | null;
  /** Vendedor do AGC dono do cliente (grandes_contas.vendedor), normalizado */
  vendedor: string;
}

interface PagamentoRPC {
  id: string;
  cliente: string;
  cpf_cnpj: string;
  nf: string;
  pedido: number | null;
  forma: string;
  valor: number | string;
  vencimento: string;
  status: string;
  link_cobranca: string | null;
}

export interface OpcoesInadimplencia {
  /** Ignora o cache e vai ao banco */
  force?: boolean;
  /** Progresso da varredura de documentos (só dispara na busca real, não no cache) */
  onProgress?: (feitos: number, total: number) => void;
}

/** A RPC buscar_pagamentos devolve no máximo 50 linhas por termo. */
export const LIMITE_RPC = 50;

const TTL_MS = 5 * 60 * 1000;
const CONCORRENCIA = 8;

const cache = new Map<string, { em: number; dados: BoletoVencido[] }>();
const emVoo = new Map<string, Promise<BoletoVencido[]>>();

const normalizar = (v?: string | null): string =>
  (v || "").trim().toLowerCase();

/** "henry" -> "Henry" (mesma regra de exibição usada no resto do app) */
const titulo = (v: string): string =>
  v.trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

const digitos = (v: string): string => v.replace(/\D/g, "");

const diasDesde = (iso: string): number => {
  const venc = new Date(iso);
  if (isNaN(venc.getTime())) return 0;
  const d = Math.floor((Date.now() - venc.getTime()) / 86400000);
  return d > 0 ? d : 0;
};

/** Executa `fn` sobre os itens com no máximo `limite` chamadas simultâneas. */
async function comConcorrencia<T, R>(
  itens: T[],
  limite: number,
  fn: (item: T) => Promise<R>,
  onProgress?: (feitos: number, total: number) => void,
): Promise<R[]> {
  const resultados = new Array<R>(itens.length);
  let proximo = 0;
  let feitos = 0;
  const worker = async () => {
    while (proximo < itens.length) {
      const i = proximo++;
      resultados[i] = await fn(itens[i]);
      feitos++;
      onProgress?.(feitos, itens.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limite, itens.length) }, worker));
  return resultados;
}

/** cod_cliente -> vendedor do AGC, só carteira ativa. */
async function fetchCarteiraAtiva(): Promise<{ cod: number; vendedor: string }[]> {
  const linhas: { cod: number; vendedor: string }[] = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await externalSupabase
      .from("grandes_contas")
      .select("cod_cliente, vendedor")
      .eq("ativo", true)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    linhas.push(...data.map(g => ({ cod: Number(g.cod_cliente), vendedor: normalizar(g.vendedor) })));
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return linhas;
}

async function buscar(vendedor: string | undefined, onProgress?: OpcoesInadimplencia["onProgress"]): Promise<BoletoVencido[]> {
  const carteira = await fetchCarteiraAtiva();
  const alvo = normalizar(vendedor);
  const filtrada = alvo ? carteira.filter(c => c.vendedor === alvo) : carteira;
  if (filtrada.length === 0) return [];

  // Cadastro (nome + documento) dos clientes da carteira
  const vendedorPorCod = new Map(filtrada.map(c => [c.cod, c.vendedor]));
  const codigos = [...vendedorPorCod.keys()];
  const clientes: { codcli: number; cliente: string; cpf_cnpj: string }[] = [];
  for (let i = 0; i < codigos.length; i += 200) {
    const { data, error } = await externalSupabase
      .from("clientes")
      .select("codcli, cliente, cpf_cnpj")
      .in("codcli", codigos.slice(i, i + 200));
    if (error) throw error;
    (data || []).forEach(c => {
      if (!c.cpf_cnpj) return;
      clientes.push({ codcli: Number(c.codcli), cliente: c.cliente || `Cliente ${c.codcli}`, cpf_cnpj: c.cpf_cnpj });
    });
  }

  // Um cliente pode repetir o documento (matriz/filial): consulta uma vez por documento
  const porDocumento = new Map<string, typeof clientes[number]>();
  clientes.forEach(c => {
    const doc = digitos(c.cpf_cnpj);
    if (doc && !porDocumento.has(doc)) porDocumento.set(doc, c);
  });
  const docs = [...porDocumento.entries()];

  onProgress?.(0, docs.length);

  const lotes = await comConcorrencia(docs, CONCORRENCIA, async ([doc, cli]) => {
    try {
      const { data, error } = await externalSupabase.rpc("buscar_pagamentos", { termo: doc });
      if (error) throw error;
      return { cli, pags: (data || []) as PagamentoRPC[] };
    } catch (err) {
      console.error("Erro ao buscar pagamentos do cliente", cli.codcli, err);
      return { cli, pags: [] as PagamentoRPC[] };
    }
  }, onProgress);

  // A RPC faz LEFT JOIN em faturamento: a mesma cobrança repete por pedido.
  const vistos = new Set<string>();
  const resultado: BoletoVencido[] = [];
  for (const { cli, pags } of lotes) {
    for (const p of pags) {
      if (p.status !== "overdue") continue;
      if (vistos.has(p.id)) continue;
      vistos.add(p.id);
      resultado.push({
        id: p.id,
        cod_cliente: cli.codcli,
        cliente: cli.cliente,
        cpf_cnpj: cli.cpf_cnpj,
        nf: p.nf,
        pedido: p.pedido,
        forma: p.forma,
        valor: Number(p.valor) || 0,
        vencimento: p.vencimento,
        dias_atraso: diasDesde(p.vencimento),
        vendedor: titulo(vendedorPorCod.get(cli.codcli) || ""),
        link_cobranca: p.link_cobranca,
      });
    }
  }

  return resultado.sort((a, b) => b.dias_atraso - a.dias_atraso);
}

export async function fetchInadimplencia(
  vendedor?: string,
  opts: OpcoesInadimplencia = {},
): Promise<BoletoVencido[]> {
  const chave = normalizar(vendedor) || "__todos__";

  if (!opts.force) {
    const hit = cache.get(chave);
    if (hit && Date.now() - hit.em < TTL_MS) return hit.dados;
    const rodando = emVoo.get(chave);
    if (rodando) return rodando;
  }

  const promise = buscar(vendedor, opts.onProgress)
    .then(dados => {
      cache.set(chave, { em: Date.now(), dados });
      return dados;
    })
    .finally(() => {
      if (emVoo.get(chave) === promise) emVoo.delete(chave);
    });

  emVoo.set(chave, promise);
  return promise;
}

/** Contagem para o badge — usa o mesmo cache da aba, então não dobra o custo. */
export async function countInadimplencia(vendedor?: string): Promise<number> {
  const dados = await fetchInadimplencia(vendedor);
  return dados.length;
}
