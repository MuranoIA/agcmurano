import { externalSupabase } from "@/integrations/supabase/externalClient";

// ---- TIPOS ----

export type Prioridade = "urgente" | "alta" | "normal" | "baixa";
export type StatusVisita = "agendada" | "realizada" | "reagendada" | "cancelada";
export type Turno = "manha" | "tarde";

export interface AgendaVisita {
  id: number;
  cod_cliente: number;
  vendedor: string;
  data_visita: string; // YYYY-MM-DD
  turno: Turno;
  ordem: number;
  status: StatusVisita;
  vendeu: boolean;
  valor_venda: number;
  observacao: string | null;
  resultado: string | null;
  prioridade: Prioridade;
  motivo_prioridade: string | null;
  mes_referencia: string; // YYYY-MM
  gerado_automaticamente: boolean;
  prospeccao?: boolean; // visita fora do AGC (cliente não é grande conta)
  nome_prospeccao?: string; // nome digitado do cliente de prospecção
  criado_em?: string;
  atualizado_em?: string;
}

export interface InteligenciaCliente {
  cod_cliente: number;
  vendedor: string;
  regiao: string;
  nome: string;
  dt_ultima_compra: string | null;
  dias_sem_compra: number;
  meses_ativos: number;
  fat_total: number;
  ciclo_medio: number;
  status_cliente: "ativo" | "risco" | "inativo";
  prioridade_sugerida: Prioridade;
  motivo_prioridade: string | null;
}

// Limites de visitas por dia
export const VISITAS_OBRIGATORIAS = 4; // mínimo gerado automaticamente
export const VISITAS_MAX = 12; // máximo por dia (inclui adições manuais)

const ORDEM_PRIORIDADE: Record<Prioridade, number> = {
  urgente: 0,
  alta: 1,
  normal: 2,
  baixa: 3,
};

/** Extrai mensagem legível de um erro desconhecido. */
export const errMsg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

// ---- HELPERS DE DATA (sempre em horário local, evitando armadilha do UTC) ----

/** Formata um Date como YYYY-MM-DD usando os componentes LOCAIS (não toISOString, que converte para UTC). */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Converte "YYYY-MM-DD" em Date local (new Date("YYYY-MM-DD") é interpretado como UTC e pode trocar o dia). */
export function parseISODate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Mês de referência (YYYY-MM) de uma data. */
export function mesRefDe(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Retorna a terça-feira da semana que contém a data informada. */
export function getTerca(d: Date): Date {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = date.getDay(); // 0=Dom ... 6=Sáb
  const diff = dow === 0 ? -5 : 2 - dow; // desloca para terça (2)
  date.setDate(date.getDate() + diff);
  return date;
}

/** Os 4 dias da semana (terça a sexta) a partir de uma terça. */
export function diasDaSemana(terca: Date): Date[] {
  return [0, 1, 2, 3].map(i => {
    const d = new Date(terca);
    d.setDate(d.getDate() + i);
    return d;
  });
}

/** Dias úteis do mês (terça=2 a sexta=5) como strings YYYY-MM-DD. */
export function getDiasUteis(mesRef: string): string[] {
  const [ano, mes] = mesRef.split("-").map(Number);
  const dias: string[] = [];
  const d = new Date(ano, mes - 1, 1);
  while (d.getMonth() === mes - 1) {
    const dow = d.getDay();
    if (dow >= 2 && dow <= 5) dias.push(toISODate(d));
    d.setDate(d.getDate() + 1);
  }
  return dias;
}

// ---- LEITURA ----

/** Inteligência por cliente (vw_inteligencia_agenda). Opcionalmente filtra por vendedor e região. */
export async function fetchInteligencia(vendedor?: string, regiao?: string): Promise<InteligenciaCliente[]> {
  let q = externalSupabase.from("vw_inteligencia_agenda").select("*");
  if (vendedor) q = q.eq("vendedor", vendedor);
  if (regiao) q = q.eq("regiao", regiao);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as InteligenciaCliente[];
}

/** Agenda de um mês de referência. Opcionalmente filtra por vendedor. */
export async function fetchAgenda(mesRef: string, vendedor?: string): Promise<AgendaVisita[]> {
  let q = externalSupabase
    .from("agenda_gc")
    .select("*")
    .eq("mes_referencia", mesRef);
  if (vendedor) q = q.eq("vendedor", vendedor);
  const { data, error } = await q.order("data_visita").order("ordem");
  if (error) throw error;
  return (data ?? []) as AgendaVisita[];
}

/** Lista distinta de vendedores com clientes na inteligência (usada pelo seletor do gestor). */
export async function fetchVendedoresAgenda(): Promise<string[]> {
  const { data, error } = await externalSupabase
    .from("vw_inteligencia_agenda")
    .select("vendedor");
  if (error) throw error;
  const set = new Set<string>();
  ((data ?? []) as { vendedor: string }[]).forEach(r => { if (r.vendedor) set.add(r.vendedor); });
  return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

/** Mapa cod_cliente -> nome (a partir da inteligência), para exibir nomes nos cards e relatório. */
export async function fetchNomesClientes(): Promise<Record<number, string>> {
  const { data, error } = await externalSupabase
    .from("vw_inteligencia_agenda")
    .select("cod_cliente, nome");
  if (error) throw error;
  const map: Record<number, string> = {};
  ((data ?? []) as { cod_cliente: number; nome: string }[]).forEach(r => { map[r.cod_cliente] = r.nome; });
  return map;
}

// ---- ESCRITA ----

/** Atualiza campos de uma visita (status, vendeu, valor, observacao, resultado, etc). */
export async function updateVisita(id: number, fields: Partial<AgendaVisita>): Promise<void> {
  const { error } = await externalSupabase
    .from("agenda_gc")
    .update({ ...fields, atualizado_em: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/** Move uma visita para outro dia (drag & drop). Atualiza data e mês de referência. */
export async function moveVisita(id: number, novaData: string, novaOrdem?: number): Promise<void> {
  const fields: Partial<AgendaVisita> = {
    data_visita: novaData,
    mes_referencia: novaData.slice(0, 7),
  };
  if (novaOrdem != null) fields.ordem = novaOrdem;
  await updateVisita(id, fields);
}

/** Cancela uma visita (mantém o registro). */
export async function cancelarVisita(id: number): Promise<void> {
  await updateVisita(id, { status: "cancelada" });
}

/** Remove fisicamente uma visita. */
export async function deleteVisita(id: number): Promise<void> {
  const { error } = await externalSupabase.from("agenda_gc").delete().eq("id", id);
  if (error) throw error;
}

interface NovaVisitaManual {
  cod_cliente: number;
  vendedor: string;
  data_visita: string;
  ordem: number;
  prioridade?: Prioridade;
  motivo_prioridade?: string | null;
  prospeccao?: boolean;
  nome_prospeccao?: string;
}

/** Adiciona uma visita manual (não gerada automaticamente). */
export async function addVisitaManual(v: NovaVisitaManual): Promise<AgendaVisita> {
  const prospeccao = v.prospeccao === true;
  const row = {
    cod_cliente: prospeccao ? 0 : v.cod_cliente,
    vendedor: v.vendedor,
    data_visita: v.data_visita,
    turno: v.ordem <= 2 ? "manha" : "tarde",
    ordem: v.ordem,
    status: "agendada" as StatusVisita,
    prioridade: v.prioridade ?? "normal",
    motivo_prioridade: v.motivo_prioridade ?? null,
    mes_referencia: v.data_visita.slice(0, 7),
    gerado_automaticamente: false,
    prospeccao,
    nome_prospeccao: prospeccao ? (v.nome_prospeccao ?? null) : null,
  };
  const { data, error } = await externalSupabase
    .from("agenda_gc")
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return data as AgendaVisita;
}

/**
 * Gera a agenda do mês para um vendedor, distribuindo clientes por prioridade
 * (urgente → alta → normal → baixa), 4 visitas por dia útil (terça a sexta).
 * Remove a agenda gerada automaticamente anterior do mês antes de inserir.
 */
export async function gerarAgendaMes(vendedor: string, mesRef: string): Promise<number> {
  // 1. Buscar clientes do vendedor com inteligência (somente região Capital)
  const clientes = await fetchInteligencia(vendedor, "capital");
  if (clientes.length === 0) return 0;

  // 2. Ordenar por prioridade (urgente primeiro)
  clientes.sort(
    (a, b) =>
      (ORDEM_PRIORIDADE[a.prioridade_sugerida] ?? 9) -
      (ORDEM_PRIORIDADE[b.prioridade_sugerida] ?? 9),
  );

  // 3. Dias úteis do mês (terça a sexta)
  const diasUteis = getDiasUteis(mesRef);
  if (diasUteis.length === 0) return 0;

  // 4. Distribuir 4 clientes por dia
  const agenda: Omit<AgendaVisita, "id">[] = [];
  let diaIdx = 0;
  let ordemNoDia = 1;

  for (const cliente of clientes) {
    if (diaIdx >= diasUteis.length) break;
    agenda.push({
      cod_cliente: cliente.cod_cliente,
      vendedor,
      data_visita: diasUteis[diaIdx],
      turno: ordemNoDia <= 2 ? "manha" : "tarde",
      ordem: ordemNoDia,
      status: "agendada",
      vendeu: false,
      valor_venda: 0,
      observacao: null,
      resultado: null,
      prioridade: cliente.prioridade_sugerida ?? "normal",
      motivo_prioridade: cliente.motivo_prioridade,
      mes_referencia: mesRef,
      gerado_automaticamente: true,
    });
    ordemNoDia++;
    if (ordemNoDia > VISITAS_OBRIGATORIAS) {
      ordemNoDia = 1;
      diaIdx++;
    }
  }

  // 5. Deletar agenda gerada automaticamente anterior do mês
  const { error: delError } = await externalSupabase
    .from("agenda_gc")
    .delete()
    .eq("vendedor", vendedor)
    .eq("mes_referencia", mesRef)
    .eq("gerado_automaticamente", true);
  if (delError) throw delError;

  // 6. Inserir nova agenda
  const { error: insError } = await externalSupabase.from("agenda_gc").insert(agenda);
  if (insError) throw insError;

  return agenda.length;
}
