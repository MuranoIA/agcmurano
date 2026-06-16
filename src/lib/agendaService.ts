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
  ciclo_medio: number;
  frequencia_3m: number;
  total_pedidos: number;
  ticket_medio: number;
  tm_mensal: number;
  objetivo: number;
  fat_mes_atual: number;
  score_rfm: number;
  visitas_mes_sugeridas: number;
  status_cliente: string;
  prioridade_sugerida: Prioridade;
  motivo_prioridade: string;
}

// Limites de visitas por dia
export const VISITAS_OBRIGATORIAS = 4; // mínimo gerado automaticamente
export const VISITAS_MAX = 12; // máximo por dia (inclui adições manuais)

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
 * Gera a agenda do mês para um vendedor usando lógica RFM.
 *
 * Cada cliente é repetido conforme `visitas_mes_sugeridas` (1 a 4, baseado no
 * ciclo de compra) e distribuído nos dias úteis (terça a sexta) de HOJE em
 * diante, com espaçamento mínimo entre visitas do mesmo cliente e ordenação por
 * score RFM (maior primeiro). Todos os dias futuros são preenchidos com até 4
 * visitas obrigatórias, sem dias vazios.
 *
 * Preserva o histórico: nunca gera, deleta ou modifica visitas de datas passadas.
 */
export async function gerarAgendaMes(vendedor: string, mesRef: string): Promise<number> {
  // 1. Buscar clientes com inteligência RFM (somente região Capital)
  const clientes = await fetchInteligencia(vendedor, "capital");
  if (!clientes.length) return 0;

  // 2. Dias úteis do mês (ter-sex), APENAS de hoje pra frente
  const hoje = toISODate(new Date()); // data local
  const diasUteis = getDiasUteis(mesRef).filter(d => d >= hoje); // só futuros
  if (!diasUteis.length) return 0;

  const VISITAS_DIA = VISITAS_OBRIGATORIAS; // 4 obrigatórias por dia

  // 3. Expandir clientes conforme visitas_mes_sugeridas
  interface VisitaSlot {
    cod_cliente: number;
    score_rfm: number;
    prioridade: Prioridade;
    motivo: string;
    visitaNum: number; // 1ª, 2ª, 3ª ou 4ª visita do mês
  }

  const slots: VisitaSlot[] = [];
  for (const cli of clientes) {
    const nVisitas = Math.min(Math.max(cli.visitas_mes_sugeridas || 1, 1), 4); // 1 a 4
    for (let i = 1; i <= nVisitas; i++) {
      slots.push({
        cod_cliente: cli.cod_cliente,
        score_rfm: cli.score_rfm,
        prioridade: cli.prioridade_sugerida ?? "normal",
        motivo: cli.motivo_prioridade,
        visitaNum: i,
      });
    }
  }

  // 4. Ordenar: 1ª visita de todos antes de 2ª; dentro de cada, maior score RFM primeiro
  slots.sort((a, b) => {
    if (a.visitaNum !== b.visitaNum) return a.visitaNum - b.visitaNum;
    return b.score_rfm - a.score_rfm;
  });

  // 5. Distribuir nos dias com espaçamento mínimo entre visitas do mesmo cliente
  const agenda: Array<{
    cod_cliente: number;
    data_visita: string;
    turno: Turno;
    ordem: number;
    prioridade: Prioridade;
    motivo_prioridade: string;
  }> = [];

  const ultimoDia: Record<number, number> = {}; // cod_cliente → índice do último dia agendado
  const visitasPorDia: Record<number, number> = {}; // índice do dia → contagem

  for (const slot of slots) {
    let melhorDia = -1;

    for (let d = 0; d < diasUteis.length; d++) {
      if ((visitasPorDia[d] || 0) >= VISITAS_DIA) continue; // dia cheio

      if (ultimoDia[slot.cod_cliente] !== undefined) {
        const distancia = d - ultimoDia[slot.cod_cliente];
        const espacMin = slot.visitaNum <= 2 ? 3 : 2; // 3 dias entre visitas, 2 pra frequentes
        if (distancia < espacMin) continue;
      }

      melhorDia = d;
      break;
    }

    // Relaxa o espaçamento: qualquer dia com espaço, desde que não seja o mesmo dia
    if (melhorDia === -1) {
      for (let d = 0; d < diasUteis.length; d++) {
        if ((visitasPorDia[d] || 0) >= VISITAS_DIA) continue;
        if (ultimoDia[slot.cod_cliente] === d) continue; // nunca 2x no mesmo dia
        melhorDia = d;
        break;
      }
    }

    if (melhorDia === -1) break; // todos os dias cheios

    const ordemNoDia = (visitasPorDia[melhorDia] || 0) + 1;
    agenda.push({
      cod_cliente: slot.cod_cliente,
      data_visita: diasUteis[melhorDia],
      turno: ordemNoDia <= 2 ? "manha" : "tarde",
      ordem: ordemNoDia,
      prioridade: slot.prioridade,
      motivo_prioridade: slot.motivo,
    });

    visitasPorDia[melhorDia] = ordemNoDia;
    ultimoDia[slot.cod_cliente] = melhorDia;
  }

  // 6. Deletar agenda auto-gerada anterior do mês, APENAS de hoje pra frente
  //    (histórico de datas passadas é preservado)
  const { error: delError } = await externalSupabase
    .from("agenda_gc")
    .delete()
    .eq("vendedor", vendedor)
    .eq("mes_referencia", mesRef)
    .eq("gerado_automaticamente", true)
    .gte("data_visita", hoje);
  if (delError) throw delError;

  // 7. Inserir nova agenda em batches de 50
  if (agenda.length > 0) {
    const rows = agenda.map(a => ({
      ...a,
      vendedor,
      status: "agendada" as StatusVisita,
      vendeu: false,
      valor_venda: 0,
      observacao: null,
      resultado: null,
      mes_referencia: mesRef,
      gerado_automaticamente: true,
    }));

    for (let i = 0; i < rows.length; i += 50) {
      const batch = rows.slice(i, i + 50);
      const { error: insError } = await externalSupabase.from("agenda_gc").insert(batch);
      if (insError) throw insError;
    }
  }

  return agenda.length;
}
