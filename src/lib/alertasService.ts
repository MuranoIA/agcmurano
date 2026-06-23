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
}

export interface HistoricoAGC {
  id: number;
  cod_cliente: number;
  tipo_evento: string;
  detalhes: string;
  usuario: string;
  created_at: string;
  nome_cliente?: string;
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

    return data.map(a => ({
      ...a,
      nome_cliente: nomes[a.cod_cliente] || `Cliente ${a.cod_cliente}`,
      dias_pendente: Math.floor((Date.now() - new Date(a.created_at).getTime()) / 86400000),
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
export async function aprovarAlerta(id: number, usuario: string): Promise<void> {
  const { error } = await externalSupabase
    .from("alertas_agc")
    .update({
      status: "aprovado",
      resolvido_por: usuario,
      resolvido_em: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
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

export const errMsg = (e: unknown): string => (e instanceof Error ? e.message : String(e));
