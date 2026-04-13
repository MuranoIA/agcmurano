export interface Cliente {
  Codigo: string;
  Nome: string;
  Vendedor: string;
  Objetivo_R$: number;
  TM_Mes: number;
  TM_Pedido: number;
  Ciclo_Medio_d: number;
  MCC: number;
  Meses_1a_Compra: number;
  Dias_Sem_Compra: number;
  Status: "Ativo" | "Risco" | "Inativo";
  Dias_Para_Acao: number;
  Proxima_Acao: string;
  N_Pedidos: number;
  Fat_Total: number;
  Primeira_Compra: string;
  Ultima_Compra: string;
  meses: Record<string, number>; // "Jan/25" -> value
}

export interface Visita {
  codigo: string;
  nome: string;
  vendedor: string;
  data: string;
  hora: string;
  teve_venda: boolean;
  observacao: string;
}

export interface OverlayStore {
  vendedores: Record<string, string>;
  valores_mes: Record<string, Record<string, number>>;
  visitas: Visita[];
}

export const VENDEDORES = ["Jacques", "Maiara", "Hugo"] as const;
