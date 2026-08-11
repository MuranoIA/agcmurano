import { externalSupabase } from "@/integrations/supabase/externalClient";

// ---- HELPERS DE DATA (sempre em horário local, nunca UTC) ----

/** "2026-08-11" -> Date local (evita o shift de fuso do `new Date("YYYY-MM-DD")`) */
export function parseDiaLocal(dia: string): Date {
  const [ano, mes, d] = dia.split("-").map(Number);
  return new Date(ano, (mes || 1) - 1, d || 1);
}

/** Date -> "2026-08-11" */
export function toDiaISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Date -> "2026-08" */
export function toMesRef(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ---- METAS ----

export interface MetaVendedor {
  vendedor: string;
  mes_referencia: string;
  meta_valor: number;
}

export async function fetchMetas(mesRef: string): Promise<MetaVendedor[]> {
  const { data, error } = await externalSupabase
    .from("metas_agc")
    .select("vendedor, mes_referencia, meta_valor")
    .eq("mes_referencia", mesRef);
  if (error) throw error;
  return (data || []).map(m => ({ ...m, meta_valor: Number(m.meta_valor) || 0 }));
}

export async function upsertMeta(vendedor: string, mesRef: string, valor: number, usuario: string): Promise<void> {
  const { error } = await externalSupabase
    .from("metas_agc")
    .upsert({
      vendedor,
      mes_referencia: mesRef,
      meta_valor: valor,
      criado_por: usuario,
      atualizado_em: new Date().toISOString(),
    }, { onConflict: "vendedor,mes_referencia" });
  if (error) throw error;
}

// ---- DIAS ÚTEIS ----

export interface DiaUtil {
  dia: string;
  dia_util: boolean;
  motivo: string | null;
}

export async function fetchDiasUteis(mesRef: string): Promise<DiaUtil[]> {
  const { data, error } = await externalSupabase
    .from("dias_uteis_agc")
    .select("dia, dia_util, motivo")
    .eq("mes_referencia", mesRef)
    .order("dia");
  if (error) throw error;
  return (data || []).map(d => ({ ...d, dia_util: d.dia_util !== false }));
}

export async function toggleDiaUtil(dia: string, diaUtil: boolean, motivo: string | null, usuario: string): Promise<void> {
  const { error } = await externalSupabase
    .from("dias_uteis_agc")
    .update({ dia_util: diaUtil, motivo, criado_por: usuario })
    .eq("dia", dia);
  if (error) throw error;
}

/** Cria (ou repõe) todos os dias do mês: seg–sáb úteis, domingo não útil. */
export async function gerarDiasMes(mesRef: string): Promise<void> {
  const [ano, mes] = mesRef.split("-").map(Number);
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const dias = [];
  for (let d = 1; d <= ultimoDia; d++) {
    const data = new Date(ano, mes - 1, d);
    const dow = data.getDay(); // 0 = domingo
    dias.push({
      mes_referencia: mesRef,
      dia: toDiaISO(data),
      dia_util: dow !== 0,
      motivo: dow === 0 ? "Domingo" : null,
    });
  }
  const { error } = await externalSupabase
    .from("dias_uteis_agc")
    .upsert(dias, { onConflict: "dia" });
  if (error) throw error;
}

// ---- TENDÊNCIA ----

/** Tendência = (faturamento até agora ÷ dias úteis já corridos) × total de dias úteis do mês */
export function calcularTendencia(
  fatAtual: number,
  diasUteisPassados: number,
  totalDiasUteis: number
): number {
  if (diasUteisPassados === 0) return 0;
  return (fatAtual / diasUteisPassados) * totalDiasUteis;
}

export const errMsgMeta = (e: unknown): string => (e instanceof Error ? e.message : String(e));
