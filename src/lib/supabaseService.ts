import { supabase } from "@/integrations/supabase/client";
import { Cliente, Visita, OverlayStore } from "./types";
import { Json } from "@/integrations/supabase/types";

// ---- VENDEDOR NAME NORMALIZATION ----

const VENDEDOR_NORMALIZE: Record<string, string> = {
  "jaques": "Jacques",
  "jacques": "Jacques",
  "hugo": "Hugo",
  "maiara": "Maiara",
  "jacques interior": "Jacques Interior",
  "jaques interior": "Jacques Interior",
  "hugo interior": "Hugo Interior",
  "maiara interior": "Maiara Interior",
};

function normalizeVendedor(v: string | null | undefined): string {
  if (!v) return "";
  const key = v.trim().toLowerCase();
  return VENDEDOR_NORMALIZE[key] || v;
}

// ---- CLIENTES ----

export async function fetchClientes(): Promise<{ clientes: Cliente[]; mesesCols: string[] }> {
  // Paginate to get ALL clients (Supabase default limit is 1000)
  let allData: any[] = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase.from("clientes").select("*").range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allData = allData.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  if (allData.length === 0) return { clientes: [], mesesCols: [] };
  const data = allData;

  // Detect month columns from the first record's meses JSONB
  const sampleMeses = (data[0].meses as Record<string, number>) || {};
  const mesRegex = /^[A-Za-z]{3}\/\d{2}$/;
  const mesesCols = Object.keys(sampleMeses).filter(k => mesRegex.test(k)).sort((a, b) => {
    const [ma, ya] = a.split("/");
    const [mb, yb] = b.split("/");
    if (ya !== yb) return ya.localeCompare(yb);
    const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
    return meses.indexOf(ma) - meses.indexOf(mb);
  });

  const clientes: Cliente[] = data.map(r => ({
    Codigo: r.codigo,
    Nome: r.nome,
    Vendedor: normalizeVendedor(r.vendedor),
    Objetivo_R$: r.objetivo_rs || 0,
    TM_Mes: r.tm_mes || 0,
    TM_Pedido: r.tm_pedido || 0,
    Ciclo_Medio_d: r.ciclo_medio_d || 0,
    MCC: r.mcc || 0,
    Meses_1a_Compra: r.meses_1a_compra || 0,
    Dias_Sem_Compra: r.dias_sem_compra || 0,
    Status: (["Ativo", "Risco", "Inativo"].includes(r.status || "") ? r.status : "Inativo") as Cliente["Status"],
    Dias_Para_Acao: r.dias_para_acao || 0,
    Proxima_Acao: r.proxima_acao || "",
    N_Pedidos: r.n_pedidos || 0,
    Fat_Total: r.fat_total || 0,
    Primeira_Compra: r.primeira_compra || "",
    Ultima_Compra: r.ultima_compra || "",
    Segmento: r.segmento || "capital",
    meses: (r.meses as Record<string, number>) || {},
  }));

  return { clientes, mesesCols };
}

export async function upsertClientes(clientes: Cliente[]): Promise<void> {
  // Delete all existing then insert (simple full-replace on CSV upload)
  await supabase.from("clientes").delete().neq("codigo", "___impossible___");

  const rows = clientes.map(c => ({
    codigo: c.Codigo,
    nome: c.Nome,
    vendedor: c.Vendedor || null,
    objetivo_rs: c.Objetivo_R$ || null,
    tm_mes: c.TM_Mes || null,
    tm_pedido: c.TM_Pedido || null,
    ciclo_medio_d: c.Ciclo_Medio_d || null,
    mcc: c.MCC || null,
    meses_1a_compra: c.Meses_1a_Compra || null,
    dias_sem_compra: c.Dias_Sem_Compra || null,
    status: c.Status || null,
    dias_para_acao: c.Dias_Para_Acao || null,
    proxima_acao: c.Proxima_Acao || null,
    n_pedidos: c.N_Pedidos || null,
    fat_total: c.Fat_Total || null,
    primeira_compra: c.Primeira_Compra || null,
    ultima_compra: c.Ultima_Compra || null,
    meses: c.meses as unknown as Json,
  }));

  // Insert in batches of 100
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100);
    const { error } = await supabase.from("clientes").insert(batch);
    if (error) throw error;
  }
}

// ---- OVERLAY: VENDEDORES ----

export async function fetchOverlayVendedores(): Promise<Record<string, string>> {
  const { data, error } = await supabase.from("overlay_vendedores").select("*");
  if (error) throw error;
  const map: Record<string, string> = {};
  data?.forEach(r => { map[r.codigo] = r.vendedor; });
  return map;
}

export async function dbSetVendedor(codigo: string, vendedor: string) {
  const { error } = await supabase.from("overlay_vendedores").upsert(
    { codigo, vendedor },
    { onConflict: "codigo" }
  );
  if (error) throw error;
}

// ---- OVERLAY: VALORES MES ----

export async function fetchOverlayValoresMes(): Promise<Record<string, Record<string, number>>> {
  // Paginate to get ALL overlay values (Supabase default limit is 1000)
  let allData: any[] = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase.from("overlay_valores_mes").select("*").range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allData = allData.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  const map: Record<string, Record<string, number>> = {};
  allData.forEach(r => {
    if (!map[r.codigo]) map[r.codigo] = {};
    map[r.codigo][r.mes] = r.valor;
  });
  return map;
}

export async function dbSetValorMes(codigo: string, mes: string, valor: number) {
  const { error } = await supabase.from("overlay_valores_mes").upsert(
    { codigo, mes, valor },
    { onConflict: "codigo,mes" }
  );
  if (error) throw error;
}

export async function dbBulkSetValoresMes(rows: { codigo: string; mes: string; valor: number }[]) {
  // Upsert in batches of 200
  for (let i = 0; i < rows.length; i += 200) {
    const batch = rows.slice(i, i + 200);
    const { error } = await supabase.from("overlay_valores_mes").upsert(
      batch,
      { onConflict: "codigo,mes" }
    );
    if (error) {
      console.error("Erro bulk upsert overlay_valores_mes batch", i, error);
    }
  }
}

// ---- OVERLAY: VISITAS ----

export async function fetchOverlayVisitas(): Promise<(Visita & { id: string })[]> {
  const { data, error } = await supabase.from("overlay_visitas").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(r => ({
    id: r.id,
    codigo: r.codigo,
    nome: r.nome,
    vendedor: r.vendedor,
    data: r.data,
    hora: r.hora,
    teve_venda: r.teve_venda,
    observacao: r.observacao || "",
  }));
}

export async function dbAddVisita(v: Visita) {
  const { error } = await supabase.from("overlay_visitas").insert({
    codigo: v.codigo,
    nome: v.nome,
    vendedor: v.vendedor,
    data: v.data,
    hora: v.hora,
    teve_venda: v.teve_venda,
    observacao: v.observacao,
  });
  if (error) throw error;
}

export async function dbRemoveVisita(id: string) {
  const { error } = await supabase.from("overlay_visitas").delete().eq("id", id);
  if (error) throw error;
}

// ---- BULK UPDATE CLIENTES (recalculated fields) ----

export async function bulkUpdateClienteFields(clientes: { codigo: string; tm_mes: number; ciclo_medio_d: number; dias_sem_compra: number; status: string; dias_para_acao: number; proxima_acao: string; objetivo_rs: number }[]) {
  for (const c of clientes) {
    const { error } = await supabase.from("clientes").update({
      tm_mes: c.tm_mes,
      ciclo_medio_d: c.ciclo_medio_d,
      dias_sem_compra: c.dias_sem_compra,
      status: c.status,
      dias_para_acao: c.dias_para_acao,
      proxima_acao: c.proxima_acao,
      objetivo_rs: c.objetivo_rs,
    }).eq("codigo", c.codigo);
    if (error) console.error("Erro update cliente", c.codigo, error);
  }
}

// ---- FULL OVERLAY ----

export async function fetchFullOverlay(): Promise<OverlayStore> {
  const [vendedores, valores_mes, visitasRaw] = await Promise.all([
    fetchOverlayVendedores(),
    fetchOverlayValoresMes(),
    fetchOverlayVisitas(),
  ]);
  const visitas: Visita[] = visitasRaw.map(({ id, ...rest }) => rest);
  return { vendedores, valores_mes, visitas };
}

// ---- REALTIME SUBSCRIPTIONS ----

export function subscribeToOverlayChanges(callback: () => void) {
  const channel = supabase.channel("overlay-realtime")
    .on("postgres_changes", { event: "*", schema: "public", table: "overlay_vendedores" }, callback)
    .on("postgres_changes", { event: "*", schema: "public", table: "overlay_valores_mes" }, callback)
    .on("postgres_changes", { event: "*", schema: "public", table: "overlay_visitas" }, callback)
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}
