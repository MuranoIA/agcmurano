import { externalSupabase } from "@/integrations/supabase/externalClient";

export interface AlertaAGC {
  id: number;
  cod_cliente: number;
  vendedor_rca: string;
  tipo_alerta: "novo_rca" | "rca_mudou" | "rca_removido";
  status: "pendente" | "aprovado" | "removido";
  detalhes: string;
  resolvido_por: string | null;
  resolvido_em: string | null;
  created_at: string;
  // campos extras da JOIN
  nome_cliente?: string;
  dias_pendente?: number;
  reentrada?: ReentradaInfo | null;
}

export interface ReentradaInfo {
  cod_cliente: number;
  saiu_em: string;
  saiu_por: string;
  motivo_saida: string;
  dias_fora: number;
}

export interface HistoricoAGC {
  id: number;
  cod_cliente: number;
  tipo_evento: string;
  detalhes: string;
  usuario: string;
  created_at: string;
  nome_cliente?: string;
  vendedor_rca?: string;
}

export interface ClienteRejeitadoNoRCA {
  cod_cliente: number;
  nome_cliente: string;
  vendedor_rca: string;
  rejeitado_em: string;
  rejeitado_por: string;
  dias_desde_rejeicao: number;
}

export interface HistoricoFiltros {
  vendedor?: string;
  dataInicio?: string; // YYYY-MM-DD
  dataFim?: string;    // YYYY-MM-DD
  tipoEvento?: string;
}

const diasDesde = (iso: string): number =>
  Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);

const fmtDataBR = (iso: string): string => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
};

// Histórico de saída do AGC de um cliente (null = nunca saiu)
export async function verificarReentrada(codCliente: number): Promise<ReentradaInfo | null> {
  const { data } = await externalSupabase
    .from("historico_agc")
    .select("created_at, usuario, detalhes")
    .eq("cod_cliente", codCliente)
    .eq("tipo_evento", "saiu_agc")
    .order("created_at", { ascending: false })
    .limit(1);

  if (!data || data.length === 0) return null;

  return {
    cod_cliente: codCliente,
    saiu_em: data[0].created_at,
    saiu_por: data[0].usuario,
    motivo_saida: data[0].detalhes,
    dias_fora: diasDesde(data[0].created_at),
  };
}

// Versão em lote (uma query só) — usada pela lista de pendências
export async function verificarReentradas(codigos: number[]): Promise<Record<number, ReentradaInfo>> {
  if (codigos.length === 0) return {};
  const { data } = await externalSupabase
    .from("historico_agc")
    .select("cod_cliente, created_at, usuario, detalhes")
    .in("cod_cliente", codigos)
    .eq("tipo_evento", "saiu_agc")
    .order("created_at", { ascending: false });

  const mapa: Record<number, ReentradaInfo> = {};
  (data || []).forEach(h => {
    if (mapa[h.cod_cliente]) return; // já registrou a saída mais recente
    mapa[h.cod_cliente] = {
      cod_cliente: h.cod_cliente,
      saiu_em: h.created_at,
      saiu_por: h.usuario,
      motivo_saida: h.detalhes,
      dias_fora: diasDesde(h.created_at),
    };
  });
  return mapa;
}

// Buscar alertas pendentes
export async function fetchAlertasPendentes(): Promise<AlertaAGC[]> {
  const { data, error } = await externalSupabase
    .from("alertas_agc")
    .select("*")
    .eq("status", "pendente")
    .order("created_at", { ascending: true });
  if (error) throw error;

  // Buscar nomes dos clientes
  if (data && data.length > 0) {
    const codigos = data.map(a => a.cod_cliente);
    const { data: clientes } = await externalSupabase
      .from("clientes")
      .select("codcli, cliente")
      .in("codcli", codigos);
    const nomes: Record<number, string> = {};
    if (clientes) clientes.forEach(c => { nomes[c.codcli] = c.cliente; });

    const reentradas = await verificarReentradas(codigos);

    return data.map(a => ({
      ...a,
      nome_cliente: nomes[a.cod_cliente] || `Cliente ${a.cod_cliente}`,
      dias_pendente: diasDesde(a.created_at),
      reentrada: reentradas[a.cod_cliente] || null,
    }));
  }
  return [];
}

// Contar alertas pendentes (pra badge)
export async function countAlertasPendentes(): Promise<number> {
  const { count, error } = await externalSupabase
    .from("alertas_agc")
    .select("id", { count: "exact", head: true })
    .eq("status", "pendente");
  if (error) return 0;
  return count || 0;
}

// Aprovar alerta (cliente fica no AGC)
export async function aprovarAlerta(id: number, usuario: string, codCliente: number): Promise<void> {
  const { error } = await externalSupabase
    .from("alertas_agc")
    .update({
      status: "aprovado",
      resolvido_por: usuario,
      resolvido_em: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;

  // Registrar no histórico — diferenciando entrada normal de reentrada
  const reentrada = await verificarReentrada(codCliente);
  await externalSupabase.from("historico_agc").insert({
    cod_cliente: codCliente,
    tipo_evento: "entrou_agc",
    detalhes: reentrada
      ? `REENTRADA: Cliente reaprovado por ${usuario}. Havia sido removido por ${reentrada.saiu_por} em ${fmtDataBR(reentrada.saiu_em)} (${reentrada.dias_fora} dias fora).`
      : `Cliente aprovado no AGC por ${usuario}.`,
    usuario,
  });
}

// Remover alerta (supervisor deve tirar do RCA no Winthor)
export async function removerAlerta(id: number, usuario: string, codCliente: number): Promise<void> {
  // Marcar alerta como removido
  const { error: alertErr } = await externalSupabase
    .from("alertas_agc")
    .update({
      status: "removido",
      resolvido_por: usuario,
      resolvido_em: new Date().toISOString(),
    })
    .eq("id", id);
  if (alertErr) throw alertErr;

  // Desativar no grandes_contas
  const { error: gcErr } = await externalSupabase
    .from("grandes_contas")
    .update({ ativo: false })
    .eq("cod_cliente", codCliente);
  if (gcErr) throw gcErr;

  // Registrar no histórico
  await externalSupabase.from("historico_agc").insert({
    cod_cliente: codCliente,
    tipo_evento: "saiu_agc",
    detalhes: `Cliente removido do AGC por ${usuario}. Necessário remover do RCA no Winthor.`,
    usuario,
  });
}

// Buscar histórico
export async function fetchHistorico(limite: number = 50): Promise<HistoricoAGC[]> {
  const { data, error } = await externalSupabase
    .from("historico_agc")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limite);
  if (error) throw error;

  if (data && data.length > 0) {
    const codigos = [...new Set(data.map(h => h.cod_cliente))];
    const { data: clientes } = await externalSupabase
      .from("clientes")
      .select("codcli, cliente")
      .in("codcli", codigos);
    const nomes: Record<number, string> = {};
    if (clientes) clientes.forEach(c => { nomes[c.codcli] = c.cliente; });

    return data.map(h => ({
      ...h,
      nome_cliente: nomes[h.cod_cliente] || `Cliente ${h.cod_cliente}`,
    }));
  }
  return [];
}

// Buscar clientes rejeitados que ainda estão no RCA
export async function fetchRejeitadosNoRCA(): Promise<ClienteRejeitadoNoRCA[]> {
  // Buscar clientes com ativo=false no grandes_contas
  const { data: inativos, error } = await externalSupabase
    .from("grandes_contas")
    .select("cod_cliente, vendedor")
    .eq("ativo", false);
  if (error) throw error;
  if (!inativos || inativos.length === 0) return [];

  const codigos = inativos.map(i => i.cod_cliente);

  // Verificar quais ainda estão no RCA (tabela clientes)
  const { data: clientes } = await externalSupabase
    .from("clientes")
    .select("codcli, cliente, rca_vendedor")
    .in("codcli", codigos);

  // Buscar mapeamento RCA
  const { data: mapeamento } = await externalSupabase
    .from("mapeamento_rca")
    .select("rca_codigo, vendedor_agc")
    .eq("ativo", true);
  const mapRCA: Record<string, string> = {};
  if (mapeamento) mapeamento.forEach(m => { mapRCA[m.rca_codigo] = m.vendedor_agc; });

  // Filtrar: só os que ainda têm RCA mapeado (ainda vinculados)
  const aindaNoRCA: ClienteRejeitadoNoRCA[] = [];
  if (clientes) {
    for (const c of clientes) {
      if (!c.rca_vendedor) continue;
      const rcaCode = c.rca_vendedor.split(" ")[0];
      const vendedor = mapRCA[rcaCode];
      if (!vendedor) continue; // RCA sem mapeamento, ignora

      // Buscar data da rejeição no histórico
      const { data: hist } = await externalSupabase
        .from("historico_agc")
        .select("created_at, usuario")
        .eq("cod_cliente", c.codcli)
        .eq("tipo_evento", "saiu_agc")
        .order("created_at", { ascending: false })
        .limit(1);

      aindaNoRCA.push({
        cod_cliente: c.codcli,
        nome_cliente: c.cliente,
        vendedor_rca: vendedor,
        rejeitado_em: hist?.[0]?.created_at || "",
        rejeitado_por: hist?.[0]?.usuario || "desconhecido",
        dias_desde_rejeicao: hist?.[0]?.created_at
          ? Math.floor((Date.now() - new Date(hist[0].created_at).getTime()) / 86400000)
          : 0,
      });
    }
  }
  return aindaNoRCA;
}

// Buscar histórico com filtros e paginação
export async function fetchHistoricoFiltrado(
  filtros: HistoricoFiltros,
  limite: number = 50,
  offset: number = 0
): Promise<{ dados: HistoricoAGC[]; total: number }> {
  let query = externalSupabase
    .from("historico_agc")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limite - 1);

  // Filtro por data (a partir de julho 2026)
  if (filtros.dataInicio) {
    query = query.gte("created_at", filtros.dataInicio);
  } else {
    query = query.gte("created_at", "2026-07-01"); // default: julho
  }
  if (filtros.dataFim) {
    query = query.lte("created_at", filtros.dataFim + "T23:59:59");
  }
  if (filtros.tipoEvento) {
    query = query.eq("tipo_evento", filtros.tipoEvento);
  }

  const { data, error, count } = await query;
  if (error) throw error;

  // Buscar nomes + filtrar por vendedor se necessário
  let resultado: HistoricoAGC[] = data || [];
  if (resultado.length > 0) {
    const codigos = [...new Set(resultado.map(h => h.cod_cliente))];
    const { data: clientes } = await externalSupabase
      .from("clientes")
      .select("codcli, cliente, rca_vendedor")
      .in("codcli", codigos);
    const nomes: Record<number, string> = {};
    const vendedores: Record<number, string> = {};
    if (clientes) {
      clientes.forEach(c => {
        nomes[c.codcli] = c.cliente;
        vendedores[c.codcli] = c.rca_vendedor?.split(" ")[0] || "";
      });
    }

    // Buscar mapeamento pra resolver vendedor
    const { data: mapeamento } = await externalSupabase
      .from("mapeamento_rca")
      .select("rca_codigo, vendedor_agc");
    const mapRCA: Record<string, string> = {};
    if (mapeamento) mapeamento.forEach(m => { mapRCA[m.rca_codigo] = m.vendedor_agc; });

    resultado = resultado.map(h => ({
      ...h,
      nome_cliente: nomes[h.cod_cliente] || `Cliente ${h.cod_cliente}`,
      vendedor_rca: mapRCA[vendedores[h.cod_cliente] || ""] || "",
    }));

    // Filtrar por vendedor no JS (pq o histórico não tem coluna vendedor)
    if (filtros.vendedor) {
      resultado = resultado.filter(h => h.vendedor_rca === filtros.vendedor);
    }
  }

  return { dados: resultado, total: count || 0 };
}

// Buscar vendedores AGC ativos (pra popular o filtro)
export async function fetchVendedoresAGC(): Promise<string[]> {
  const { data } = await externalSupabase
    .from("mapeamento_rca")
    .select("vendedor_agc")
    .eq("ativo", true)
    .order("vendedor_agc");
  if (!data) return [];
  return [...new Set(data.map(m => m.vendedor_agc).filter(Boolean))];
}

export const errMsg = (e: unknown): string => (e instanceof Error ? e.message : String(e));
