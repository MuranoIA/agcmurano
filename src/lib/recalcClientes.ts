import { Cliente } from "./types";

/** Recalculate derived fields for a single client (used after overlay application) */
export function recalcCliente(c: Cliente): Cliente {
  // DSC from Ultima_Compra
  let dsc = c.Dias_Sem_Compra;
  if (c.Ultima_Compra) {
    const ucDate = new Date(c.Ultima_Compra);
    if (!isNaN(ucDate.getTime())) {
      dsc = Math.max(0, Math.floor((Date.now() - ucDate.getTime()) / (1000 * 60 * 60 * 24)));
    }
  }

  const cicloMedio = c.Ciclo_Medio_d;

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

  // Objetivo marca d'água
  const tmMes = c.TM_Mes;
  const novoObjetivo = tmMes * 1.10;
  const objetivoRs = (c.Objetivo_R$ && c.Objetivo_R$ > novoObjetivo) ? c.Objetivo_R$ : novoObjetivo;

  return {
    ...c,
    Dias_Sem_Compra: dsc,
    Status: status,
    Dias_Para_Acao: diasParaAcao,
    Proxima_Acao: proximaAcao,
    Objetivo_R$: objetivoRs,
  };
}

/** Recalculate all clients */
export function recalcAllClientes(clientes: Cliente[]): Cliente[] {
  return clientes.map(recalcCliente);
}
